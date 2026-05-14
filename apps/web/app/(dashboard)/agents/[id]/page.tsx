type Props = { params: { id: string } };

export default function AgentBuilderPage({ params }: Props): JSX.Element {
  return <div className="text-textPrimary">Agent builder for {params.id} (stub)</div>;
}
