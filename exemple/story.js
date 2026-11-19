/* ---------- Exemple : le plus petit film possible ---------- */
// Un film est une suite de segments. Chaque segment dessine l'image du temps `lt` (secondes depuis son début).
// Les dessins viennent du dossier img (a1.png, a2.png, title.png) ; make_example.py en fabrique de provisoires.
const P = (n, a, b, u) => plate(n, camAt(a, b, clamp(u)));

seg('noir', 0.8, () => {});
seg('titre', 4, (lt, d) => { titleOver(clamp((lt - 0.5) / 1.2) * clamp((d - lt) / 1), 760); });
// un plan sans paroles : la caméra avance lentement dans le dessin a1
shot('colline', { pre: 0.5, lines: [], post: 5.5 }, (lt, d) => {
  P('a1', C(.5, .5, 1.0), C(.45, .45, 1.15), lt / d); shade(clamp(1 - lt / 1.5));
});
// un second plan : un lent travelling de gauche à droite sur a2, puis fondu au noir
shot('mer', { pre: 0.5, lines: [], post: 5.5 }, (lt, d) => {
  P('a2', C(.4, .5, 1.12), C(.6, .5, 1.12), lt / d); shade(clamp((lt - (d - 1.5)) / 1.5));
});
// Pour une réplique : placer vo/L01.mp3 puis écrire  lines: [['L01', 'A', 'Le texte de la réplique.', 0.4, 'inner']]
// La durée du plan suit alors celle de l'enregistrement, et les sous-titres sont découpés automatiquement.
endCard(['Un film de', 'vous'], 5);

// Le son est synthétisé dans le navigateur : pluie, cloche, violoncelle…  (voir core_b.js pour tous les instruments)
function SCORE({ rain, cello, N, music, onMusic, at }) {
  rain(0, 0, 0); rain(T.colline, 0.08, 0.1, 5000); rain(T.card, 0, 0);
  onMusic(T.colline, 0.6); cello(N.A2, T.colline + 0.5, 9, 0.12); cello(N.E3, T.mer + 0.5, 4, 0.08);
  music.gain.setValueAtTime(0.6, at(T.card - 1.5)); music.gain.linearRampToValueAtTime(0, at(T.card));
}
