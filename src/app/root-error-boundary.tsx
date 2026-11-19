import { Component, type ReactNode } from "react";
import { ApplicationFailure } from "./error-pages";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class RootErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override render() {
    return this.state.hasError ? <ApplicationFailure /> : this.props.children;
  }
}
