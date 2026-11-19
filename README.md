# Futur antérieur — moteur d'animation

Le moteur qui fabrique les courts métrages animés de la série **Chroniques d'un futur antérieur** ([futur-anterieur.fr](https://futur-anterieur.fr)).

Un film est une page web : des dessins fixes, un scénario écrit en JavaScript, et un moteur qui les anime image par image (mouvements de caméra, bouches, clignements, poses, texte à l'écran, sous-titres) et synthétise le son dans le navigateur. La même page se regarde telle quelle ou se calcule en vidéo, jusqu'en 4K.

*English: the animation engine behind the French animated shorts “Chroniques d'un futur antérieur”. A film is a single web page — still drawings, a script written in JavaScript, an engine that animates them frame by frame and synthesises the sound in the browser. The same page plays as is, or renders to video up to 4K. MIT licence. Comments in the code are in English.*

## Ce que contient ce dépôt

| Dossier | Contenu |
|---|---|
| `core/` | Le moteur : animation (`core_a.js`), son (`core_b.js`), page (`shell.html`), construction (`build.py`, `prep.py`), export vidéo (`export.mjs`, `export_all.sh`), son master stéréo / binaural / 5.1 (`sound.mjs`, `mix.py`), outils de contrôle (`shot.mjs`, `grab.mjs`, `grid.py`, `gridview.py`, `cdp.mjs`), génération des dessins par lots (`genlib.py`) |
| `exemple/` | Le plus petit film possible, à construire en une minute |
| `pc/` | Calcul d'un film entier en 4K sur un PC Windows avec carte graphique (agrandissement des dessins par Real-ESRGAN, puis rendu) |
| `skill/` | La skill Claude Code « anime-studio » et son agent relecteur : la méthode de travail (bible, passeports des personnages, découpage, animatique, relecture par un regard neuf) |

Ce dépôt ne contient **pas** les films : leurs dessins, voix, musiques et textes ne sont pas sous licence libre.

## Essayer

Il faut Python 3 avec Pillow, Node 22 ou plus, Google Chrome et ffmpeg.

```bash
cd exemple
python3 make_example.py                      # trois dessins provisoires
python3 ../core/build.py "Exemple" exemple   # construit exemple.html
open exemple.html                            # le film, dans le navigateur
../core/export_all.sh exemple.html "Exemple" # la vidéo MP4
```

Pour que les lettres soient identiques sur toutes les machines, le moteur peut embarquer des polices libres (Inter, Source Serif 4, Cutive, Kalam, Pinyon Script, Patrick Hand, toutes sous licence OFL). Elles ne sont pas dans le dépôt ; `core/fonts/make_fonts.py` les télécharge depuis Google Fonts et écrit `core/fonts/free-fonts.html`. Sans ce fichier, le film utilise les polices de la machine.

## Écrire un film

Un film est un dossier :

```
mon-film/
  img/        les dessins (PNG 16:9) : a1.png, a1_m1.png (bouche entrouverte), a1_k.png (yeux fermés), title.png…
  vo/         les voix (L01.mp3…) et, si l'on veut, la musique (MUS.mp3)
  story.js    le film : les plans, dans l'ordre
  comps.py    (facultatif) quelles variantes se posent sur quel dessin
```

Dans `story.js`, chaque plan est un appel à `shot()` ou `seg()` :

```js
shot('cuisine', { pre: 0.5, lines: [['L01', 'A', 'Tu es rentré tard.', 0.4]], post: 1 }, (lt, d, f) => {
  plate('a1', camAt(C(.5, .5, 1.0), C(.46, .46, 1.14), lt / d), face('a1', 'A', lt));
});
```

- la durée du plan suit celle des enregistrements ; les sous-titres sont découpés automatiquement ;
- `plate()` dessine un dessin vu par une caméra (`C(x, y, zoom)`), `camAt()` va d'un cadrage à un autre ;
- `face()` anime la bouche sur la voix, `life()` ajoute clignements, sourcils et regards, `pose()` passe d'une pose à une autre ;
- tout texte visible à l'écran est tapé par le film, jamais dessiné dans l'image ;
- la fonction `SCORE()` écrit le son : pluie, pièces, cloches, violoncelle, chœur… tout est synthétisé, rien n'est enregistré.

Le film ne dépend que du temps : `FILM.render(t)` donne toujours la même image, ce qui permet de le calculer image par image, en plusieurs morceaux à la fois.

## Calculer la vidéo

- `core/export_all.sh` : 720p, 1080p (`SCALE=1.5`) ou 4K (`SCALE=3`, après `RES=3 python3 ../core/build.py …`), en plusieurs navigateurs sans écran en parallèle.
- `pc/run.py` : toute la chaîne sur un PC, dont l'agrandissement des dessins. Avec `MASTER=1` : images en pleine résolution de couleur, flou de mouvement là où l'image bouge, HEVC 10 bits, et trois mixages mesurés (stéréo, binaural pour le casque, 5.1). Voir `pc/README.md`.

## La skill Claude

Copier `skill/anime-studio` dans `~/.claude/skills/` et `skill/agents/anime-reviewer.md` dans `~/.claude/agents/`, puis `npm install` dans `skill/anime-studio/scripts`. Dans Claude Code : « adapte cette nouvelle en court métrage animé ».

## Licence

Code sous licence MIT (voir `LICENSE`). `skill/anime-studio/references/motion-design` vient de LottieFiles, sous licence MIT également (sa licence est dans le dossier).

Les films de la série, leurs dessins, voix, musiques et textes restent la propriété de leur auteur, tous droits réservés.
