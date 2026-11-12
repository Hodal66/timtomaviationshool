export default async function Done({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return (<div className="wrap sec"><h1>Application received</h1>
    <p>Your reference is <b style={{ fontSize: 22 }}>{ref}</b>. Keep it safe. You need it with your phone or email to track your application.</p>
    <p className="notice">Admissions has your application. No confirmation message is sent yet, so please write the reference down.</p>
    <p><a className="btn" href={`/track?ref=${ref}`}>Track my application</a></p></div>);
}
