export default function SectionPage({ title, subtitle }) {
    return (
        <section className="page-shell">
            <header className="page-header">
                <h1>{title}</h1>
                <p>{subtitle}</p>
            </header>

            <div className="placeholder-panel">
                <h2>Section en preparation</h2>
                <p>
                    Cette page est prete cote navigation et securisee par authentification.
                    Tu peux maintenant brancher ton contenu metier ici.
                </p>
            </div>
        </section>
    );
}
