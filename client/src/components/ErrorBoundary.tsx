import { Component, type ReactNode } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="simple-state-page">
        <section className="simple-state-card">
          <TriangleAlert size={34} />
          <div className="eyebrow">Falha inesperada</div>
          <h1>Não foi possível carregar esta tela.</h1>
          <p>Recarregue a página para tentar novamente.</p>
          <button className="button button-dark" onClick={() => window.location.reload()}><RotateCcw size={16} /> Recarregar</button>
        </section>
      </main>
    );
  }
}
