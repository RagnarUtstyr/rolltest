import { watchOrLoadGame } from "./game-service.js";
const params = new URLSearchParams(window.location.search);
const code = (params.get("code") || "").trim().toUpperCase();
const STYLE_MAP = {
  pathfinder2e:["style_pathfinder2e.css","turn_pathfinder2e.css"], pf2e:["style_pathfinder2e.css","turn_pathfinder2e.css"],
  callofcthulhu7e:["style_coc7e.css","turn_coc7e.css"], coc7e:["style_coc7e.css","turn_coc7e.css"],
  savageworlds:["style_savageworlds.css","turn_savageworlds.css"], swade:["style_savageworlds.css","turn_savageworlds.css"],
  vampire5e:["style_vampire5e.css","turn_vampire5e.css"], vtm5e:["style_vampire5e.css","turn_vampire5e.css"], worldofdarkness:["style_vampire5e.css","turn_vampire5e.css"],
  cyberpunkred:["style_cyberpunkred.css","turn_cyberpunkred.css"], lancer:["style_lancer.css","turn_lancer.css"], shadowdark:["style_shadowdark.css","turn_shadowdark.css"],
  warhammer4e:["style_wfrp4e.css","turn_wfrp4e.css"], wfrp4e:["style_wfrp4e.css","turn_wfrp4e.css"], starfinder:["style_starfinder.css","turn_starfinder.css"]
};
if (code) {
  const game = await watchOrLoadGame(code);
  const mode = String(game?.mode || "").toLowerCase();
  document.body.dataset.gameMode = mode;
  const [styleHref, turnHref] = STYLE_MAP[mode] || ["", ""];
  if (styleHref) document.getElementById("group-theme-style")?.setAttribute("href", styleHref);
  if (turnHref) document.getElementById("group-turn-theme-style")?.setAttribute("href", turnHref);
}
