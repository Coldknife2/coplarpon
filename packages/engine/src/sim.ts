// Simulation headless : l'IA joue les deux camps. Sert à équilibrer et à détecter les bugs.
//   npm run sim            -> 200 combats par rencontre
import { ENCOUNTERS, createCombat, playAiTurn, getUnit } from './index'

const classes = ['guerrier', 'pyromancien', 'pretre']
const N = Number(process.argv[2] ?? 200)

for (const enc of ENCOUNTERS) {
  let wins = 0
  let rounds = 0
  for (let i = 0; i < N; i++) {
    const { state } = createCombat({
      seed: 1000 + i,
      players: classes.map((c, k) => ({ id: `c${k}`, name: c, classId: c })),
      mobs: enc.mobs,
    })
    let s = state
    let guard = 0
    while (s.phase === 'fighting' && guard++ < 2000) {
      s = playAiTurn(s).state
    }
    if (s.winner === 0) wins++
    rounds += s.round
    void getUnit
  }
  console.log(`${enc.name.padEnd(22)} victoires joueurs: ${((wins / N) * 100).toFixed(0)}%  durée moyenne: ${(rounds / N).toFixed(1)} rounds`)
}
