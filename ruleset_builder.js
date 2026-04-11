import { requireAuth } from './auth.js';
import { db } from './firebase-config.js';
import { watchOrLoadGame } from './game-service.js';
import { getRulesetSystem } from './ruleset_systems.js';
import {
  ref,
  get,
  set
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js';

const params = new URLSearchParams(window.location.search);
const code = (params.get('code') || '').trim().toUpperCase();
const modeHint = (params.get('mode') || '').trim().toLowerCase();

const titleEl = document.getElementById('builder-title');
const descriptionEl = document.getElementById('builder-description');
const gameMetaEl = document.getElementById('builder-game-meta');
const rulesBasisEl = document.getElementById('builder-rules-basis');
const formEl = document.getElementById('builder-form');
const summaryGridEl = document.getElementById('summary-grid');
const derivedGridEl = document.getElementById('derived-grid');
const statusEl = document.getElementById('builder-status');
const playerLinkEl = document.getElementById('builder-player-link');

function playerSheetPath(codeValue, uid) {
  return `games/${codeValue}/players/${uid}`;
}

function playerEntryPath(codeValue, uid) {
  return `games/${codeValue}/entries/${uid}`;
}

function builderSheetPath(codeValue, mode, uid) {
  return `games/${codeValue}/builderSheets/${mode}/${uid}`;
}

function numOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function groupFields(fields) {
  const groups = {
    identity: [],
    abilities: [],
    combat: [],
    choices: [],
    notes: []
  };
  for (const field of fields) {
    const bucket = groups[field.section] || groups.notes;
    bucket.push(field);
  }
  return groups;
}

function fieldMarkup(field) {
  const id = `builder-${field.id}`;
  const full = field.type === 'textarea' ? 'full' : '';
  const attrs = [];
  if (field.placeholder) attrs.push(`placeholder="${escapeHtml(field.placeholder)}"`);
  if (field.min !== undefined) attrs.push(`min="${field.min}"`);
  if (field.max !== undefined) attrs.push(`max="${field.max}"`);
  if (field.defaultValue !== undefined && field.type !== 'textarea') attrs.push(`value="${escapeHtml(field.defaultValue)}"`);

  const control = field.type === 'textarea'
    ? `<textarea id="${id}" data-field-id="${field.id}" ${attrs.join(' ')}></textarea>`
    : `<input id="${id}" data-field-id="${field.id}" type="${field.type || 'text'}" ${attrs.join(' ')} />`;

  return `
    <div class="field-stack ${full}">
      <label for="${id}">${escapeHtml(field.label)}</label>
      ${control}
      ${field.help ? `<div class="muted small">${escapeHtml(field.help)}</div>` : ''}
    </div>
  `;
}

function sectionMarkup(title, fields) {
  if (!fields.length) return '';
  return `
    <section class="ruleset-panel section-card">
      <h2>${escapeHtml(title)}</h2>
      <div class="form-grid">
        ${fields.map(fieldMarkup).join('')}
      </div>
    </section>
  `;
}

function collectFormValues(system) {
  const values = {};
  for (const field of system.fields) {
    const el = document.getElementById(`builder-${field.id}`);
    if (!el) continue;
    values[field.id] = field.type === 'number' ? numOrNull(el.value) : el.value.trim();
  }
  return values;
}

function setFormValues(system, values = {}) {
  for (const field of system.fields) {
    const el = document.getElementById(`builder-${field.id}`);
    if (!el) continue;
    const value = values[field.id];
    el.value = value ?? field.defaultValue ?? '';
  }
}

function renderSummary(system, values) {
  const cards = [
    { label: 'Character', value: values.characterName || '—' },
    ...system.summaryFields.map((fieldId) => {
      const field = system.fields.find((item) => item.id === fieldId);
      return {
        label: field?.label || fieldId,
        value: values[fieldId] || '—'
      };
    }),
    { label: 'Initiative', value: values.initiative ?? '—' },
    { label: 'HP / Wounds', value: values.currentHp ?? values.maxHp ?? '—' }
  ];

  summaryGridEl.innerHTML = cards.map((card) => `
    <div class="summary-card">
      <div class="summary-label">${escapeHtml(card.label)}</div>
      <div class="summary-value">${escapeHtml(card.value)}</div>
    </div>
  `).join('');
}

function renderDerived(system, values) {
  const derived = typeof system.derived === 'function' ? system.derived(values) : [];
  if (!derived.length) {
    derivedGridEl.innerHTML = '<div class="muted small">This builder uses mostly manual entry for legality and derived totals.</div>';
    return;
  }

  derivedGridEl.innerHTML = derived.map((card) => `
    <div class="derived-card">
      <div class="derived-label">${escapeHtml(card.label)}</div>
      <div class="derived-value">${escapeHtml(card.value)}</div>
    </div>
  `).join('');
}

async function main() {
  const user = await requireAuth();
  if (!code) {
    statusEl.textContent = 'Missing game code.';
    return;
  }

  const game = await watchOrLoadGame(code);
  if (!game) {
    statusEl.textContent = 'Game not found.';
    return;
  }

  const mode = String(game.mode || modeHint || '').toLowerCase();
  const system = getRulesetSystem(modeHint || mode);

  if (!system) {
    statusEl.textContent = `Unsupported builder mode: ${modeHint || mode}`;
    return;
  }

  document.documentElement.style.setProperty('--accent', system.accent);
  titleEl.textContent = `${system.name} Builder`;
  descriptionEl.textContent = system.description;
  rulesBasisEl.textContent = system.rulesBasis;
  gameMetaEl.textContent = `${game.title} · Code: ${game.code} · Mode: ${game.mode}`;
  playerLinkEl.href = `player.html?code=${encodeURIComponent(code)}`;
  document.title = `${system.name} Builder`;

  const groups = groupFields(system.fields);
  formEl.innerHTML = [
    sectionMarkup('Identity', groups.identity),
    sectionMarkup('Abilities / Traits', groups.abilities),
    sectionMarkup('Combat / Tracking', groups.combat),
    sectionMarkup('Choices / Features', groups.choices),
    sectionMarkup('Notes', groups.notes)
  ].join('');

  const [builderSnap, playerSnap] = await Promise.all([
    get(ref(db, builderSheetPath(code, system.key, user.uid))),
    get(ref(db, playerSheetPath(code, user.uid)))
  ]);

  const existingBuilder = builderSnap.exists() ? builderSnap.val() : null;
  const existingPlayer = playerSnap.exists() ? playerSnap.val() : null;
  const seedValues = {
    characterName: existingBuilder?.values?.characterName || existingPlayer?.name || '',
    initiative: existingBuilder?.values?.initiative ?? existingPlayer?.initiative ?? existingPlayer?.initiativeBonus ?? '',
    currentHp: existingBuilder?.values?.currentHp ?? existingPlayer?.currentHp ?? existingPlayer?.health ?? '',
    maxHp: existingBuilder?.values?.maxHp ?? existingPlayer?.baseHp ?? ''
  };

  setFormValues(system, { ...seedValues, ...(existingBuilder?.values || {}) });

  const refresh = () => {
    const values = collectFormValues(system);
    renderSummary(system, values);
    renderDerived(system, values);
  };

  formEl.querySelectorAll('input, textarea, select').forEach((el) => {
    el.addEventListener('input', refresh);
  });
  refresh();

  async function saveBuilder(pushRoomSummary) {
    const values = collectFormValues(system);
    const sheetPayload = {
      uid: user.uid,
      mode: system.key,
      gameCode: code,
      updatedAt: Date.now(),
      values
    };

    const compactPlayer = {
      ...(existingPlayer || {}),
      uid: user.uid,
      mode: system.key,
      name: values.characterName || existingPlayer?.name || user.displayName || '',
      playerName: values.characterName || existingPlayer?.playerName || user.displayName || '',
      initiative: numOrNull(values.initiative) ?? existingPlayer?.initiative ?? null,
      initiativeBonus: numOrNull(values.initiative) ?? existingPlayer?.initiativeBonus ?? null,
      number: numOrNull(values.initiative) ?? existingPlayer?.number ?? null,
      currentHp: numOrNull(values.currentHp) ?? existingPlayer?.currentHp ?? null,
      health: numOrNull(values.currentHp) ?? existingPlayer?.health ?? null,
      baseHp: numOrNull(values.maxHp) ?? existingPlayer?.baseHp ?? null,
      ac: numOrNull(values.ac) ?? numOrNull(values.kac) ?? numOrNull(values.eac) ?? existingPlayer?.ac ?? null,
      customSheet: {
        system: system.key,
        values,
        summary: system.summaryFields.reduce((acc, fieldId) => {
          acc[fieldId] = values[fieldId] ?? '';
          return acc;
        }, {})
      },
      updatedAt: Date.now()
    };

    const roomEntry = {
      uid: user.uid,
      name: compactPlayer.name,
      playerName: compactPlayer.playerName,
      initiative: compactPlayer.initiative,
      initiativeBonus: compactPlayer.initiativeBonus,
      number: compactPlayer.number,
      health: compactPlayer.health,
      updatedAt: compactPlayer.updatedAt,
      mode: system.key,
      summary: compactPlayer.customSheet.summary
    };

    await set(ref(db, builderSheetPath(code, system.key, user.uid)), sheetPayload);

    if (pushRoomSummary) {
      await Promise.all([
        set(ref(db, playerSheetPath(code, user.uid)), compactPlayer),
        set(ref(db, playerEntryPath(code, user.uid)), roomEntry)
      ]);
    }
  }

  document.getElementById('save-builder-button')?.addEventListener('click', async () => {
    try {
      await saveBuilder(false);
      statusEl.textContent = 'Builder saved.';
    } catch (error) {
      console.error(error);
      statusEl.textContent = error.message || 'Could not save builder.';
    }
  });

  document.getElementById('save-init-button')?.addEventListener('click', async () => {
    try {
      await saveBuilder(true);
      statusEl.textContent = 'Builder and room summary saved.';
    } catch (error) {
      console.error(error);
      statusEl.textContent = error.message || 'Could not save to the room.';
    }
  });
}

main().catch((error) => {
  console.error(error);
  statusEl.textContent = error.message || 'Builder failed to load.';
});
