import "@/styles/files.css";

export default function Loading() {
  return (
    <main className="container files-page" aria-busy="true">
      <div className="files-skeleton files-skeleton--title" />
      <div className="files-skeleton files-skeleton--filter" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="files-skeleton files-skeleton--row" />
      ))}
    </main>
  );
}