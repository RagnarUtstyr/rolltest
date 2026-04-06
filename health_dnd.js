import { ref, update, onValue, remove } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-database.js";
import { db } from "./firebase-config.js";
import { requireAuth } from "./auth.js";

await requireAuth();

function getGameCode() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("code") || "").trim().toUpperCase();
}

function getEntriesPath() {
    const code = getGameCode();
    if (!code) throw new Error("Missing game code in URL.");
    return `games/${code}/entries`;
}

function normalizeEntry(id, entry) {
    return {
        id,
        name: entry.name ?? entry.playerName ?? "Unknown",
        number: entry.number ?? entry.initiative ?? 0,
        health: entry.health ?? null,
        ac: entry.ac ?? null,
        url: entry.url ?? null
    };
}

// Function to fetch and display rankings with health update functionality
function fetchRankings() {
    const reference = ref(db, getEntriesPath());

    onValue(reference, (snapshot) => {
        const data = snapshot.val();
        const rankingList = document.getElementById('rankingList');
        rankingList.innerHTML = '';

        if (!data) {
            console.log('No data available');
            return;
        }

        const rankings = Object.entries(data)
            .map(([id, entry]) => normalizeEntry(id, entry))
            .sort((a, b) => (b.number || 0) - (a.number || 0));

        rankings.forEach(({ id, name, ac, health, url }) => {
            const listItem = document.createElement('li');
            listItem.className = 'list-item';

            const nameAcContainer = document.createElement('div');
            nameAcContainer.className = 'name-ac-container';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'name';
            nameDiv.textContent = name;

            if (url) {
                nameDiv.style.cursor = 'pointer';
                nameDiv.addEventListener('click', () => {
                    window.open(url, '_blank');
                });
            }
            nameAcContainer.appendChild(nameDiv);

            const acDiv = document.createElement('div');
            acDiv.className = 'ac';
            acDiv.textContent = `AC: ${ac !== null && ac !== undefined ? ac : 'N/A'}`;
            nameAcContainer.appendChild(acDiv);

            listItem.appendChild(nameAcContainer);

            const healthDiv = document.createElement('div');
            healthDiv.className = 'health';
            healthDiv.textContent = `HP: ${health !== null && health !== undefined ? health : 'N/A'}`;
            listItem.appendChild(healthDiv);

            const healthInput = document.createElement('input');
            healthInput.type = 'number';
            healthInput.placeholder = 'Damage';
            healthInput.className = 'damage-input';
            healthInput.style.width = '50px';
            healthInput.dataset.entryId = id;
            healthInput.dataset.currentHealth = health ?? 0;
            listItem.appendChild(healthInput);

            if (health === 0) {
                const removeButton = document.createElement('button');
                removeButton.textContent = 'Remove';
                removeButton.className = 'remove-button';
                removeButton.addEventListener('click', () => {
                    removeEntry(id, listItem);
                });
                listItem.appendChild(removeButton);
            }

            if (health === 0) {
                listItem.classList.add('defeated');
            }

            rankingList.appendChild(listItem);
        });
    });
}

// Function to apply damage to all entries
function applyDamageToAll() {
    const damageInputs = document.querySelectorAll('.damage-input');
    damageInputs.forEach(input => {
        const entryId = input.dataset.entryId;
        const currentHealth = parseInt(input.dataset.currentHealth, 10);
        const damage = parseInt(input.value, 10);

        if (!isNaN(damage) && !isNaN(currentHealth)) {
            const updatedHealth = currentHealth - damage;
            updateHealth(entryId, updatedHealth > 0 ? updatedHealth : 0, input);
        }

        input.value = '';
    });
}

// Function to update health in Firebase and UI
function updateHealth(id, newHealth, healthInput) {
    const reference = ref(db, `${getEntriesPath()}/${id}`);
    update(reference, { health: newHealth })
        .then(() => {
            const healthDiv = healthInput.parentElement.querySelector('.health');
            healthDiv.textContent = `HP: ${newHealth}`;

            const listItem = healthInput.parentElement;

            if (newHealth <= 0) {
                listItem.classList.add('defeated');
                healthInput.disabled = false;
                healthInput.style.display = 'inline-block';
                healthInput.dataset.currentHealth = newHealth;

                let removeButton = listItem.querySelector('.remove-button');
                if (!removeButton) {
                    removeButton = document.createElement('button');
                    removeButton.textContent = 'Remove';
                    removeButton.className = 'remove-button';
                    removeButton.addEventListener('click', () => {
                        removeEntry(id, listItem);
                    });
                    listItem.appendChild(removeButton);
                }
            } else {
                healthInput.dataset.currentHealth = newHealth;
                listItem.classList.remove('defeated');
            }
        })
        .catch((error) => {
            console.error('Error updating health:', error);
        });
}

// Function to remove an entry
function removeEntry(id, listItem) {
    const reference = ref(db, `${getEntriesPath()}/${id}`);
    remove(reference)
        .then(() => {
            listItem.remove();
        })
        .catch((error) => {
            console.error('Error removing entry:', error);
        });
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        getEntriesPath();
    } catch (error) {
        console.error(error);
        return;
    }

    if (document.getElementById('rankingList')) {
        fetchRankings();
    }

    const applyDamageButton = document.getElementById('apply-damage-button');
    if (applyDamageButton) {
        applyDamageButton.addEventListener('click', applyDamageToAll);
    }
});