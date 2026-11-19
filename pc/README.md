# Chroniques d'un futur antérieur — calcul des films sur le PC

Tout se fait ici, sans le Mac : agrandissement des dessins, construction du film, calcul des images, assemblage.

    run.cmd serotonine            un film en 4K
    run.cmd all                   les sept films en 4K
    run.cmd divan 1.5             un film en 1080p
    run.cmd nour 3 30 40          essai : seulement le passage de 30 s à 40 s

Films : serotonine, nour, dit, camille, divan, catalogue, ouroboros.

Résultat dans `out\<Titre> (4K).mp4`, journal dans `out\log.txt`.

- `films\<film>\` : les sources de chaque film (dessins `img`, voix `vo`, scénario `story.js`). `img4k` est créé par l'agrandissement.
- `core\` : le moteur commun et les scripts d'export. `models\` : le modèle d'agrandissement Real-ESRGAN x4plus.
- Réglages par variables d'environnement : `JOBS` (nombre de Chrome en parallèle, 5 par défaut), `CRF` (qualité finale, 21 en 4K).
- Python utilisé : celui de ComfyUI (torch, spandrel, Pillow), appelé par `run.cmd`. Il faut aussi Node, Chrome et ffmpeg, déjà installés.
- L'agrandissement prend environ 3 Go de mémoire graphique pendant quelques minutes par film ; le calcul des images utilise le processeur.

Les sources viennent du Mac. Après une modification d'un film sur le Mac (voix, scénario, dessin), il faut recopier son dossier ici avant de relancer.
