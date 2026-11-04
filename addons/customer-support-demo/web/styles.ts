// Layout only; controls and colors belong to the host design system.
export const styles = `
.cs-demo { color: var(--foreground); min-width: 0; display: grid; gap: 1.5rem; }
.cs-demo h2 { font-size: 1.5rem; font-weight: 600; }
.cs-demo h3 { font-size: 1rem; font-weight: 600; }
.cs-demo__muted { color: var(--muted-foreground); font-size: .875rem; }
.cs-demo__actions { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
.cs-demo__stats { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1rem; }
.cs-demo__stats strong { display: block; font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.cs-demo__ticket { display: grid; gap: .5rem; padding: 1rem 0; border-bottom: 1px solid var(--border); }
.cs-demo__error { color: var(--destructive); }
.cs-demo__form { display: grid; gap: 1.5rem; }
.cs-demo__form input { width: 100%; }
`;
