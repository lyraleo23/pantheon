import { normalize } from './format'

/**
 * `targetPlatform` é texto livre ("Nintendo Switch / Nintendo Switch 2", e uma
 * string de duas linhas no Hyrule Warriors), então o console sai de um casamento
 * por padrão, não de igualdade. O lookahead do Switch é o que importa: sem ele,
 * "switch" casaria com "Nintendo Switch 2", que não roda no Switch 1.
 *
 * Um jogo pode casar com mais de um console — e deve: Breath of the Wild é
 * Switch e Switch 2, Hyrule Warriors é Wii U e Switch.
 */
export const PLATFORMS: { id: string; label: string; match: RegExp }[] = [
  { id: 'switch', label: 'Switch', match: /switch(?! 2)/ },
  { id: 'switch2', label: 'Switch 2', match: /switch 2/ },
  { id: 'wiiu', label: 'Wii U', match: /wii u/ },
]

/** O jogo roda em algum dos consoles escolhidos? Seleção vazia = sem restrição. */
export function matchesPlatforms(targetPlatform: string, ids: string[]): boolean {
  if (ids.length === 0) return true
  const target = normalize(targetPlatform)
  return PLATFORMS.some((p) => ids.includes(p.id) && p.match.test(target))
}
