import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react';
import { buildSeasonDatabase, DATABASE_MANIFEST } from '../data/database';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { Club, ManagerProfile, SeasonId } from '../types';
import { ClubCrest } from '../components/shared/ClubCrest';
import { CompetitionEmblem, GameBrandMark, OvrBadge } from '../components/shared/GamePrimitives';
import { formatMoney } from '../utils/format';

type WizardStep = 1 | 2 | 3 | 4 | 5;

const PHILOSOPHIES: ManagerProfile['philosophy'][] = [
  'Possession',
  'High Press',
  'Counter-Attack',
  'Balanced',
  'Pragmatic',
];

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Season',
  2: 'League',
  3: 'Club',
  4: 'Manager',
  5: 'Confirm',
};

export const NewCareer: React.FC = () => {
  const { startNewCareer, settings } = useCareerStore();
  const { navigate, pushToast } = useUiStore();

  const [step, setStep] = useState<WizardStep>(1);
  const [selectedSeason, setSelectedSeason] = useState<SeasonId>('2014/15');
  const [selectedCountry, setSelectedCountry] = useState<string>('All');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('epl');
  const [selectedClubId, setSelectedClubId] = useState<string>('chelsea');

  const [clubSearch, setClubSearch] = useState('');
  const [minRepFilter, setMinRepFilter] = useState<number>(0);
  const [minFinanceFilter, setMinFinanceFilter] = useState<number>(0);

  const [managerName, setManagerName] = useState('Alex Mercer');
  const [managerNationality, setManagerNationality] = useState('England');
  const [philosophy, setPhilosophy] = useState<ManagerProfile['philosophy']>('Balanced');
  const [saveName, setSaveName] = useState('');
  const [creating, setCreating] = useState(false);

  const seasonBundle = useMemo(() => buildSeasonDatabase(selectedSeason), [selectedSeason]);

  const domesticLeagues = useMemo(
    () =>
      Object.values(seasonBundle.competitions).filter(
        (c) => c.competitionFormat === 'league'
      ),
    [seasonBundle]
  );

  const countries = useMemo(
    () => ['All', ...Array.from(new Set(domesticLeagues.map((l) => l.country)))],
    [domesticLeagues]
  );

  const filteredLeagues = useMemo(
    () =>
      domesticLeagues.filter(
        (l) => selectedCountry === 'All' || l.country === selectedCountry
      ),
    [domesticLeagues, selectedCountry]
  );

  const availableClubs = useMemo(() => {
    const q = clubSearch.trim().toLowerCase();
    return Object.values(seasonBundle.clubs)
      .filter((c) => {
        if (selectedLeagueId && c.leagueId !== selectedLeagueId) return false;
        if (selectedCountry !== 'All' && c.country !== selectedCountry) return false;
        if (c.reputation < minRepFilter) return false;
        if (c.financialStrength < minFinanceFilter) return false;
        if (q && !c.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.reputation - a.reputation);
  }, [seasonBundle, selectedLeagueId, selectedCountry, minRepFilter, minFinanceFilter, clubSearch]);

  const selectedClub: Club | undefined = seasonBundle.clubs[selectedClubId] ?? availableClubs[0];

  const getClubSquadStrength = (club: Club) => {
    const ratings = club.squadIds
      .map((id) => seasonBundle.players[id]?.overallRating ?? 70)
      .sort((a, b) => b - a)
      .slice(0, 11);
    return Math.round(ratings.reduce((a, b) => a + b, 0) / Math.max(1, ratings.length));
  };

  const handleSelectLeague = (leagueId: string) => {
    setSelectedLeagueId(leagueId);
    const firstInLeague = Object.values(seasonBundle.clubs)
      .filter((c) => c.leagueId === leagueId)
      .sort((a, b) => b.reputation - a.reputation)[0];
    if (firstInLeague) {
      setSelectedClubId(firstInLeague.id);
    }
  };

  const handleConfirmCreate = async () => {
    if (!selectedClub || creating) return;
    setCreating(true);
    try {
      await startNewCareer({
        seasonId: selectedSeason,
        clubId: selectedClub.id,
        managerName: managerName.trim() || 'Alex Mercer',
        managerNationality: managerNationality.trim() || 'England',
        philosophy,
        saveName: saveName.trim() || `${selectedClub.name} (${selectedSeason})`,
      });
      pushToast('success', `Career started with ${selectedClub.name} (${selectedSeason}).`);
      navigate('dashboard');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Failed to create career.');
      setCreating(false);
    }
  };

  const stepTitles: Record<WizardStep, string> = {
    1: '1. Historical Season Selection',
    2: '2. Competition Selection',
    3: '3. Club Selection',
    4: '4. Manager Profile',
    5: '5. Career Confirmation',
  };

  return (
    <div className="min-h-screen ft-stadium-bg text-[#F4F5F0]">
      <header className="h-16 border-b border-slate-800/80 bg-[#070B14]/95 px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={() => (step === 1 ? navigate('main_menu') : setStep((step - 1) as WizardStep))}
            className="inline-flex items-center gap-1.5 rounded border border-slate-700/80 bg-[#101829] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <GameBrandMark size={24} className="hidden sm:block" />
            <span className="font-display text-lg sm:text-xl font-extrabold tracking-wider text-[#F4F5F0] truncate">
              FOOTBALL TYCOON · NEW CAREER
            </span>
          </div>
        </div>
        <div className="text-xs font-mono text-emerald-400 tabular-nums shrink-0">
          Step {step} of 5
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Tactical Step Progress Bar */}
        <div className="grid grid-cols-5 gap-2">
          {([1, 2, 3, 4, 5] as WizardStep[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => s <= step && setStep(s)}
              className="text-left space-y-1.5 group"
              aria-label={`Step ${s}`}
            >
              <div
                className={`h-1.5 rounded-xs transition-colors ${
                  s === step
                    ? 'bg-emerald-400'
                    : s < step
                      ? 'bg-emerald-700'
                      : 'bg-slate-800'
                }`}
              />
              <div
                className={`text-[10px] font-mono uppercase tracking-wider truncate ${
                  s === step
                    ? 'text-emerald-300 font-bold'
                    : s < step
                      ? 'text-slate-300'
                      : 'text-slate-500'
                }`}
              >
                {s}. {STEP_LABELS[s]}
              </div>
            </button>
          ))}
        </div>

        <div className="ft-broadcast-strip rounded-lg px-5 py-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#F4F5F0] leading-none">
            {stepTitles[step]}
          </h1>
          <div className="text-xs font-mono text-emerald-300">
            {selectedSeason}
            {step >= 3 && selectedClub ? ` · ${selectedClub.name}` : ''}
          </div>
        </div>

        {/* STEP 1: HISTORICAL SEASON */}
        {step === 1 && (
          <div className="space-y-5">
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {DATABASE_MANIFEST.disclaimer}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DATABASE_MANIFEST.seasons.map((season) => {
                const active = selectedSeason === season.seasonId;
                return (
                  <button
                    key={season.seasonId}
                    type="button"
                    data-testid={`season-card-${season.seasonId}`}
                    onClick={() => setSelectedSeason(season.seasonId)}
                    className={`text-left rounded-lg p-5 transition-all flex flex-col justify-between gap-4 relative overflow-hidden ${
                      active
                        ? 'ft-panel border-emerald-400/70 bg-emerald-500/10 ring-1 ring-emerald-400/40'
                        : 'ft-panel hover:border-slate-600/80'
                    }`}
                  >
                    {active && (
                      <div className="absolute top-0 inset-x-0 h-1 bg-emerald-400" aria-hidden="true" />
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-3xl font-extrabold text-[#F4F5F0] tabular-nums">
                          {season.seasonId}
                        </span>
                        {active && (
                          <span className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-emerald-300" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300">{season.description}</p>
                    </div>
                    <div className="pt-3 border-t border-slate-800/80 space-y-1 text-xs text-slate-400">
                      <div className="font-mono">
                        Clubs: <span className="text-[#F4F5F0]">{season.availableClubsCount}</span> ·
                        Competitions: <span className="text-[#F4F5F0]">{season.availableCompetitions.length}</span>
                      </div>
                      <div className="text-emerald-400/90 font-medium">{season.completenessLabel}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white"
              >
                <span>Continue to Competition</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: COMPETITION SELECTION */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {countries.map((country) => (
                <button
                  key={country}
                  type="button"
                  onClick={() => {
                    setSelectedCountry(country);
                    const match = domesticLeagues.find(
                      (l) => country === 'All' || l.country === country
                    );
                    if (match) handleSelectLeague(match.id);
                  }}
                  className={`px-3.5 py-2 rounded text-xs font-semibold border transition-colors min-h-[38px] ${
                    selectedCountry === country
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                      : 'border-slate-800 bg-[#0E1626] text-slate-300 hover:text-white'
                  }`}
                >
                  {country}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLeagues.map((league) => {
                const active = selectedLeagueId === league.id;
                return (
                  <button
                    key={league.id}
                    type="button"
                    data-testid={`league-card-${league.id}`}
                    onClick={() => handleSelectLeague(league.id)}
                    className={`text-left rounded-lg p-5 transition-all flex items-center justify-between gap-4 relative overflow-hidden ${
                      active
                        ? 'ft-panel border-emerald-400/70 bg-emerald-500/10 ring-1 ring-emerald-400/40'
                        : 'ft-panel hover:border-slate-600/80'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <CompetitionEmblem competitionId={league.id} size={46} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                          {league.country} · Tier {league.tier}
                        </div>
                        <div className="font-display text-2xl font-extrabold text-[#F4F5F0] mt-0.5 truncate">
                          {league.name}
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-1 tabular-nums">
                          {league.clubIds.length} Clubs · {league.totalMatchdays} Matchdays
                        </div>
                      </div>
                    </div>
                    {active && <Check className="h-5 w-5 text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white"
              >
                <span>Continue to Club Selection</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CLUB SELECTION */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Filters */}
            <div className="ft-panel rounded-lg p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative sm:col-span-2">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clubSearch}
                  onChange={(e) => setClubSearch(e.target.value)}
                  placeholder="Filter clubs by name..."
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] pl-9 pr-3 py-2 text-sm text-[#F4F5F0] placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <select
                value={minRepFilter}
                onChange={(e) => setMinRepFilter(Number(e.target.value))}
                aria-label="Minimum club reputation"
                className="rounded border border-slate-700/80 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0] focus:border-emerald-500 focus:outline-none"
              >
                <option value={0}>Any Reputation</option>
                <option value={80}>Reputation 80+</option>
                <option value={85}>Reputation 85+</option>
                <option value={90}>Reputation 90+</option>
              </select>
              <select
                value={minFinanceFilter}
                onChange={(e) => setMinFinanceFilter(Number(e.target.value))}
                aria-label="Minimum financial strength"
                className="rounded border border-slate-700/80 bg-[#070B14] px-3 py-2 text-sm text-[#F4F5F0] focus:border-emerald-500 focus:outline-none"
              >
                <option value={0}>Any Finances</option>
                <option value={75}>Strong Finances (75+)</option>
                <option value={85}>Elite Finances (85+)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {availableClubs.map((club) => {
                const active = selectedClub?.id === club.id;
                const xiStrength = getClubSquadStrength(club);
                const compName = seasonBundle.competitions[club.leagueId]?.shortName ?? club.leagueId;
                return (
                  <button
                    key={club.id}
                    type="button"
                    data-testid={`club-card-${club.id}`}
                    onClick={() => setSelectedClubId(club.id)}
                    className={`text-left rounded-lg p-4 transition-all flex items-center gap-4 relative overflow-hidden ${
                      active
                        ? 'ft-panel border-emerald-400/70 bg-emerald-500/10 ring-1 ring-emerald-400/40'
                        : 'ft-panel hover:border-slate-600/80'
                    }`}
                  >
                    <div
                      className="absolute inset-y-0 left-0 w-1"
                      style={{ backgroundColor: club.crest.primaryColor }}
                      aria-hidden="true"
                    />
                    <ClubCrest crest={club.crest} size={50} className="ml-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-xl font-bold text-[#F4F5F0] truncate">
                          {club.name}
                        </span>
                        <OvrBadge rating={xiStrength} size="sm" />
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {club.country} · {compName} · {club.stadiumName}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-300 mt-2 font-mono tabular-nums">
                        <span>REP {club.reputation}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-emerald-300">
                          Budget {formatMoney(club.transferBudget, settings.currency)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {availableClubs.length === 0 && (
              <div className="ft-panel rounded-lg p-8 text-center text-sm text-slate-400">
                No clubs match the selected reputation/finance filters.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!selectedClub}
                onClick={() => {
                  if (selectedClub) setSelectedClubId(selectedClub.id);
                  setStep(4);
                }}
                className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white"
              >
                <span>Continue to Manager Profile</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: MANAGER PROFILE */}
        {step === 4 && (
          <div className="ft-panel rounded-lg p-6 space-y-5 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mgr-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Manager Name
                </label>
                <input
                  id="mgr-name"
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-3.5 py-2.5 text-sm text-[#F4F5F0] focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="mgr-nat" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nationality
                </label>
                <input
                  id="mgr-nat"
                  type="text"
                  value={managerNationality}
                  onChange={(e) => setManagerNationality(e.target.value)}
                  className="w-full rounded border border-slate-700/80 bg-[#070B14] px-3.5 py-2.5 text-sm text-[#F4F5F0] focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Preferred Tactical Philosophy
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {PHILOSOPHIES.map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => setPhilosophy(ph)}
                    className={`rounded border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      philosophy === ph
                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                        : 'border-slate-700/80 bg-[#070B14] text-slate-300 hover:text-white'
                    }`}
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="save-label" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Career Save Label (Optional)
              </label>
              <input
                id="save-label"
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={`${selectedClub?.name ?? 'Club'} (${selectedSeason})`}
                className="w-full rounded border border-slate-700/80 bg-[#070B14] px-3.5 py-2.5 text-sm text-[#F4F5F0] placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white"
              >
                <span>Review Career Summary</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: CONFIRMATION */}
        {step === 5 && selectedClub && (
          <div className="ft-panel rounded-lg p-6 space-y-6 max-w-2xl relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 w-1.5"
              style={{ backgroundColor: selectedClub.crest.primaryColor }}
              aria-hidden="true"
            />
            <div className="flex items-center gap-4 pb-5 border-b border-slate-800 pl-2">
              <ClubCrest crest={selectedClub.crest} size={60} />
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                  {selectedSeason} Historical Career Appointment
                </div>
                <h2 className="font-display text-3xl font-extrabold text-[#F4F5F0]">
                  {selectedClub.name}
                </h2>
                <div className="text-xs text-slate-400">
                  {seasonBundle.competitions[selectedClub.leagueId]?.name} · {selectedClub.stadiumName} (
                  {selectedClub.stadiumCapacity.toLocaleString()})
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm pl-2">
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Manager</div>
                <div className="font-semibold text-[#F4F5F0] mt-0.5">{managerName || 'Alex Mercer'}</div>
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Nationality</div>
                <div className="font-semibold text-[#F4F5F0] mt-0.5">{managerNationality || 'England'}</div>
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Philosophy</div>
                <div className="font-semibold text-[#F4F5F0] mt-0.5">{philosophy}</div>
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Starting Balance</div>
                <div className="font-mono font-semibold text-[#F4F5F0] tabular-nums mt-0.5">
                  {formatMoney(selectedClub.balance, settings.currency)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Transfer Budget</div>
                <div className="font-mono font-semibold text-emerald-400 tabular-nums mt-0.5">
                  {formatMoney(selectedClub.transferBudget, settings.currency)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Squad Size</div>
                <div className="font-mono font-semibold text-[#F4F5F0] tabular-nums mt-0.5">
                  {selectedClub.squadIds.length} Players
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800 pl-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded border border-slate-700 bg-[#0B111E] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-800"
              >
                Edit Profile
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={handleConfirmCreate}
                className="ft-chamfer-sm inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white"
              >
                <Check className="h-4 w-4" />
                <span>{creating ? 'Creating Career...' : 'Confirm & Start Career'}</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
