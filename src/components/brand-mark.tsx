/** A brand's mark, one colour like the line icons beside it. */
export function BrandMark({ paths, viewBox = '0 0 24 24' }: { paths: string[]; viewBox?: string }) {
  return (
    <svg aria-hidden fill="currentColor" height={16} viewBox={viewBox} width={16}>
      {paths.map((d) => (
        <path d={d} key={d.slice(0, 24)} />
      ))}
    </svg>
  )
}
