const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

export function formatDate(at: number): string {
  return dateFormatter.format(at)
}

/**
 * Comparação por texto que ignora acento e caixa — é o que a busca precisa.
 * O NFD separa a letra do acento e `\p{M}` remove as marcas combinantes, então
 * "Pokémon" casa com "pokemon".
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}
