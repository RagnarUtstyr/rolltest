/* turn_dnd.css */
:root {
  --bg-0: #090807;
  --bg-1: #0e0c0b;
  --bg-2: #14110f;
  --panel: rgba(24, 20, 17, 0.96);
  --panel-soft: rgba(30, 25, 21, 0.94);
  --border: #4d3d2c;
  --border-soft: #32281e;
  --border-strong: #68523a;
  --text: #e6ddcf;
  --text-soft: #c3b5a0;
  --heading: #f1e8d8;
  --accent: #9d7746;
  --accent-2: #bc945f;
  --accent-deep: #6e522f;
  --focus-ring: 0 0 0 4px rgba(188, 148, 95, 0.16);
  --shadow-lg: 0 26px 70px rgba(0, 0, 0, 0.55);
  --shadow-md: 0 14px 32px rgba(0, 0, 0, 0.38);
  --shadow-sm: 0 7px 18px rgba(0, 0, 0, 0.28);
  --radius-xl: 22px;
  --radius-lg: 16px;
  --radius-md: 12px;
  --radius-sm: 10px;
}

html,
body {
  margin: 0;
  min-height: 100%;
}

body {
  min-height: 100vh;
  color: var(--text);
  font-family: Georgia, "Times New Roman", serif;
  background:
    radial-gradient(circle at top, rgba(188, 148, 95, 0.05), transparent 24%),
    linear-gradient(180deg, var(--bg-1) 0%, var(--bg-0) 100%);
  position: relative;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  background:
    linear-gradient(rgba(10, 8, 7, 0.82), rgba(10, 8, 7, 0.9)),
    url("background_dnd.jpg") no-repeat center center fixed;
  background-size: cover;
  z-index: -1;
  pointer-events: none;
}

.button-container {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin: 20px 0;
  gap: 12px;
}

button,
#next-button,
#apply-damage-button,
.remove-button {
  appearance: none;
  border: 1px solid var(--accent-deep);
  border-radius: var(--radius-sm);
  background: linear-gradient(180deg, #a8834f 0%, #815f37 100%);
  color: #17120d;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
  transition:
    transform 0.14s ease,
    filter 0.14s ease,
    box-shadow 0.14s ease,
    background-color 0.3s,
    color 0.3s;
}

#next-button {
  padding: 10px 20px;
  font-size: 1em;
  width: fit-content;
  margin: 20px auto;
  display: block;
  margin-left: auto;
}

#apply-damage-button {
  margin-right: auto;
}

.remove-button {
  padding: 5px 10px;
  font-size: 0.9em;
}

#apply-damage-button:hover,
#next-button:hover,
.remove-button:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

#apply-damage-button:active,
#next-button:active,
.remove-button:active {
  transform: translateY(0);
}

#apply-damage-button:focus-visible,
#next-button:focus-visible,
.remove-button:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring), 0 8px 18px rgba(0, 0, 0, 0.3);
}

/* Strong active-turn styling */
.highlighted {
  background:
    linear-gradient(180deg, rgba(188, 148, 95, 0.24), rgba(110, 82, 47, 0.22)),
    rgba(42, 31, 22, 0.92) !important;
  color: #f6eddc !important;
  border: 2px solid #d9b36a !important;
  box-shadow:
    0 0 0 1px rgba(255, 227, 163, 0.14),
    0 0 18px rgba(217, 179, 106, 0.28),
    0 14px 30px rgba(0, 0, 0, 0.34) !important;
  transition:
    background-color 0.3s ease,
    box-shadow 0.3s ease,
    border-color 0.3s ease;
}

.highlighted .name,
.highlighted .ac,
.highlighted .health,
.highlighted .number,
.highlighted span,
.highlighted div {
  color: #f6eddc !important;
}

.highlighted input,
.highlighted .damage-input {
  background: rgba(17, 13, 10, 0.96) !important;
  color: #fff1cf !important;
  border: 1px solid #d9b36a !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.highlighted input::placeholder,
.highlighted .damage-input::placeholder {
  color: #d8c296;
}

.highlighted button,
.highlighted .remove-button {
  border-color: #d1a95f;
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.32),
    0 0 10px rgba(217, 179, 106, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

/* Keep the name looking like text even when highlighted */
.highlighted .name {
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
}

@media (max-width: 640px) {
  .button-container {
    flex-direction: column;
  }

  #next-button,
  #apply-damage-button,
  .remove-button {
    width: 100%;
    margin-left: 0;
    margin-right: 0;
  }
}