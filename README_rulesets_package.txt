roll2020 multi-ruleset extension package
=======================================

Files modified
--------------
- lobby.html
- player.html
- player.css
- player.js

Files added
-----------
- ruleset_systems.js
- ruleset_builder.html
- ruleset_builder.css
- ruleset_builder.js
- pathfinder2e_character_builder.html
- coc7_character_builder.html
- savageworlds_character_builder.html
- vampire5_character_builder.html
- cyberpunkred_character_builder.html
- lancer_character_builder.html
- shadowdark_character_builder.html
- wfrp4_character_builder.html
- starfinder_character_builder.html

How it works
------------
1. New rulesets appear in lobby.html as valid room modes.
2. player.js now accepts those modes instead of throwing an unsupported-mode error.
3. For the nine added systems, player.html shows a generic system panel with a builder link.
4. Each builder wrapper redirects into ruleset_builder.html with the right mode.
5. ruleset_builder.js stores detailed builder data at:
   games/{CODE}/builderSheets/{mode}/{uid}
6. It can also push a compact room-ready summary into:
   games/{CODE}/players/{uid}
   games/{CODE}/entries/{uid}

Important implementation note
-----------------------------
This package is designed to fit the existing coding style and Firebase flow without rewriting the D&D or Open Legend logic.

The new systems are implemented as guided builders / character worksheets. Pathfinder 2E, CoC 7E, and Shadowdark include a few safe derived-value helpers.
Other systems are kept more manual on purpose so the app does not hard-code proprietary or book-only option logic.

Recommended next repo step
--------------------------
If you want the initiative/group pages to display system-specific columns for the new builders (for example WFRP wounds, Cyberpunk armor SP, or PF2E perception), the next step would be to extend group.html/server.js/health.js with a shared mode-aware renderer similar to the builder system config.


Theme pack update:
- Added admin.js route map for the new modes.
- Added per-system player CSS, builder CSS, tracker style CSS, and tracker turn CSS for the 9 added systems.
- Updated player.html/player.js and ruleset_builder.html/ruleset_builder.js to auto-load the correct theme by mode.
