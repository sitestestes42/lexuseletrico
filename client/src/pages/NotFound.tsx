import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <main className="simple-state-page">
      <section className="simple-state-card">
        <TriangleAlert size={34} />
        <div className="eyebrow">Erro 404</div>
        <h1>Página não encontrada.</h1>
        <p>O endereço pode ter mudado ou não existir mais.</p>
        <Link href="/" className="button button-dark"><ArrowLeft size={16} /> Voltar para a loja</Link>
      </section>
    </main>
  );
}
