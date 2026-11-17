import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileJson } from 'lucide-react';
import {
  DATABASE_MANIFEST,
  validateAllHistoricalSeasons,
  validateCustomDatabaseImport,
} from '../data/database';
import { useCareerStore } from '../store/careerStore';
import { useUiStore } from '../store/uiStore';
import { CurrencyDisplay, SimulationSpeed } from '../types';
import { GamePageHeader } from '../components/shared/GamePrimitives';

export const Settings: React.FC<{ mode?: 'settings' | 'about' }> = ({ mode = 'settings' }) => {
  const { career, settings, updateSettings } = useCareerStore();
  const { navigate, pushToast } = useUiStore();
  const [importJson, setImportJson] = useState('');
  const [importStatus, setImportStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const validationReports = useMemo(() => validateAllHistoricalSeasons(), []);

  const handleValidateImport = () => {
    const res = validateCustomDatabaseImport(importJson);
    setImportStatus(res);
    if (res.ok) {
      pushToast('success', res.message);
    } else {
      pushToast('error', res.message);
    }
  };

  return (
    <div className={career ? 'space-y-6' : 'min-h-screen ft-stadium-bg text-[#F4F5F0] p-4 sm:p-8 max-w-4xl mx-auto space-y-6'}>
      {!career && (
        <button
          type="button"
          onClick={() => navigate('main_menu')}
          className="inline-flex items-center gap-2 rounded border border-slate-700 bg-[#0E1626] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Main Menu</span>
        </button>
      )}

      <GamePageHeader
        eyebrow="System & Historical Integrity"
        title={mode === 'about' ? 'About FOOTBALL TYCOON' : 'Settings & Database Inspector'}
        subtitle="Build Your Club. Control Your Legacy."
      />

      {mode === 'settings' && (
        <div className="ft-panel rounded-lg p-6 space-y-5">
          <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
            Simulation &amp; Display
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-2">
                Default Live Match Speed
              </label>
              <div className="flex gap-2">
                {(['Normal', 'Fast', 'Instant'] as SimulationSpeed[]).map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => {
                      updateSettings({ simulationSpeed: sp });
                      pushToast('success', `Default match speed set to ${sp}.`);
                    }}
                    className={`flex-1 rounded border py-2 text-xs font-bold ${
                      settings.simulationSpeed === sp
                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                        : 'border-slate-700 bg-[#070B14] text-slate-300'
                    }`}
                  >
                    {sp}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-2">
                Currency Display
              </label>
              <div className="flex gap-2">
                {(['EUR', 'GBP', 'USD'] as CurrencyDisplay[]).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => {
                      updateSettings({ currency: cur });
                      pushToast('success', `Currency switched to ${cur}.`);
                    }}
                    className={`flex-1 rounded border py-2 text-xs font-bold ${
                      settings.currency === cur
                        ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                        : 'border-slate-700 bg-[#070B14] text-slate-300'
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>

            <label className="ft-panel-inset flex items-center justify-between rounded px-4 py-3 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-[#F4F5F0]">Automatic Saving</div>
                <div className="text-xs text-slate-400">Save to IndexedDB after matches &amp; transfers</div>
              </div>
              <input
                type="checkbox"
                checked={settings.autosaveEnabled}
                onChange={(e) => updateSettings({ autosaveEnabled: e.target.checked })}
                className="h-4 w-4 accent-emerald-500"
              />
            </label>

            <label className="ft-panel-inset flex items-center justify-between rounded px-4 py-3 cursor-pointer">
              <div>
                <div className="text-sm font-semibold text-[#F4F5F0]">Match Audio Cues</div>
                <div className="text-xs text-slate-400">Subtle synthesized whistle &amp; goal chimes</div>
              </div>
              <input
                type="checkbox"
                checked={settings.soundEffectsEnabled}
                onChange={(e) => updateSettings({ soundEffectsEnabled: e.target.checked })}
                className="h-4 w-4 accent-emerald-500"
              />
            </label>
          </div>
        </div>
      )}

      {/* Historical Integrity & Coverage Transparency */}
      <div className="ft-panel rounded-lg p-6 space-y-4">
        <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
          Historical Database Coverage &amp; Integrity
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">{DATABASE_MANIFEST.disclaimer}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="ft-panel-inset rounded p-4 space-y-2">
            <div className="font-mono uppercase tracking-wider font-bold text-emerald-400">
              Verified Historical Records
            </div>
            <ul className="space-y-1 text-slate-300 list-disc list-inside">
              {DATABASE_MANIFEST.verifiedFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div className="ft-panel-inset rounded p-4 space-y-2">
            <div className="font-mono uppercase tracking-wider font-bold text-amber-300">
              Gameplay-Estimated Simulation Data
            </div>
            <ul className="space-y-1 text-slate-300 list-disc list-inside">
              {DATABASE_MANIFEST.estimatedGameplayFields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 font-mono uppercase tracking-wider text-slate-400">
              <tr>
                <th className="py-2 pr-3">Season</th>
                <th className="py-2 pr-3 text-right">Clubs</th>
                <th className="py-2 pr-3 text-right">Verified Players</th>
                <th className="py-2 pr-3 text-right">Total Squad Players</th>
                <th className="py-2 pr-3">Integrity Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 tabular-nums">
              {validationReports.map((rep) => (
                <tr key={rep.seasonId}>
                  <td className="py-2.5 pr-3 font-mono font-bold text-[#F4F5F0]">{rep.seasonId}</td>
                  <td className="py-2.5 pr-3 text-right font-mono">{rep.clubsCount}</td>
                  <td className="py-2.5 pr-3 text-right font-mono text-emerald-400">
                    {rep.historicalPlayersCount}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-mono">{rep.playersCount}</td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {rep.valid ? 'Verified Valid' : `${rep.issues.length} Issues`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Playstyle Skills & Superstar Progression Rules */}
      <div className="ft-panel rounded-lg p-6 space-y-3">
        <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
          Playstyle Skills (25) &amp; Superstar Progression
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="ft-panel-inset rounded p-4 space-y-1.5">
            <div className="font-mono uppercase tracking-wider font-bold text-sky-300">
              Natural Skill &amp; Universal Skill Tokens
            </div>
            <p>
              Every player receives one Permanent Natural Skill (Blue Slot 1) automatically
              assigned at career start or Academy promotion. Developed Skill (Purple Slot 2)
              starts locked and can be unlocked or rerolled unlimited times using shared Universal
              Skill Tokens—randomly rolling a position-compatible skill from the 25-skill
              catalogue without altering base OVR. Earn tokens from training milestones, Academy
              promotions, match achievements, and season objectives.
            </p>
          </div>
          <div className="ft-panel-inset rounded p-4 space-y-1.5">
            <div className="font-mono uppercase tracking-wider font-bold text-amber-300">
              Superstar Career Tier (No Real Money)
            </div>
            <p>
              Players display a gold star icon when holding Superstar status, granting balanced
              late-match composure without allowing low-OVR teams to overpower higher-rated squads.
              Superstars unlock strictly via two separate in-game progression paths (€2.5M club
              investment each): First-Team Elevation (Training Ground or Academy Tier 3+, 82+ OVR or
              78+ OVR with 85+ POT and 5 apps) or Youth Academy Promotion (Academy Tier 3+, 74+ OVR
              graduate).
            </p>
          </div>
        </div>
      </div>

      {/* Future Structured JSON Import Validator */}
      <div className="ft-panel rounded-lg p-6 space-y-3">
        <div className="flex items-center gap-2">
          <FileJson className="h-4 w-4 text-emerald-400" />
          <h2 className="font-display text-2xl font-bold text-[#F4F5F0]">
            Structured JSON Database Validator
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Paste a custom season JSON payload to validate club references, positions, and competition
          completeness before future import.
        </p>
        <textarea
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          rows={4}
          placeholder='{"seasonId":"2014/15","clubs":{...},"players":{...},"competitions":{...}}'
          className="w-full rounded border border-slate-700 bg-[#070B14] p-3 font-mono text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          {importStatus ? (
            <span className={`text-xs ${importStatus.ok ? 'text-emerald-400' : 'text-red-400'}`}>
              {importStatus.message}
            </span>
          ) : (
            <span className="text-xs text-slate-500">Validates schema &amp; relational integrity</span>
          )}
          <button
            type="button"
            onClick={handleValidateImport}
            className="rounded border border-slate-700 bg-[#0B1220] hover:bg-slate-800 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
          >
            Validate JSON
          </button>
        </div>
      </div>
    </div>
  );
};
