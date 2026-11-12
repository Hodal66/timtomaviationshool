export const metadata = { title: "Application received", robots: { index: false } };
export default async function Done({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return (<section className="sx"><div className="wrap wzwrap"><div className="wz done"><h1 style={{ fontSize: "2rem" }}>Application received</h1>
    {ref && <div className="ref">{ref}</div>}<p>Keep your reference. You need it, with your phone or email, to track your application.</p>
    <a className="btn pri" href={ref ? `/track?ref=${encodeURIComponent(ref)}` : "/track"}>Track my application</a></div></div></section>);
}
