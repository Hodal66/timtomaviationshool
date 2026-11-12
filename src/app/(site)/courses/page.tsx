import type { Metadata } from "next";
import { Catalogue } from "@/components/Catalogue";
import { Particles } from "@/components/Particles";
import { Reveal } from "@/components/Reveal";
import { Track } from "@/components/Track";
import { getCatalogue } from "@/lib/catalogue-data";
export const revalidate = 60;
export const metadata: Metadata = {
  title: "Courses | Timtom Aviation School",
  description: "Browse every Timtom Aviation School programme. Search by subject, compare courses and apply online.",
  alternates: { canonical: "/courses" },
};

export default async function Courses() {
  const { courses, areas } = await getCatalogue();
  return (<>
    <Track />
    <section className="cathead"><Particles density={26000} /><div className="wrap" style={{ position: "relative" }}>
      <Reveal className="shead" ><span className="eyebrow">Course catalogue</span><h1>Find the programme that fits your career</h1>
        <p className="lead">Every programme below is approved by the School. Open one to see its details, intakes and fees.</p></Reveal>
    </div></section>
    <section className="sx" style={{ paddingTop: 0 }}><div className="wrap" style={{ marginTop: -8 }}>
      {courses.length === 0 ? <p className="empty">Programmes will appear here as soon as the School publishes them.</p> :
        <Catalogue courses={courses} areas={areas} />}
    </div></section>
  </>);
}
