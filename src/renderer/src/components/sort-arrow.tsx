import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react'

const arrows = { asc: ArrowUpIcon, desc: ArrowDownIcon } as const

/** Direction marker after a sortable column header; nothing while the column is unsorted. */
export const SortArrow = ({ sorted }: { readonly sorted: false | keyof typeof arrows }) => {
  if (sorted === false) return null
  const Arrow = arrows[sorted]
  return <Arrow className="size-3" />
}
