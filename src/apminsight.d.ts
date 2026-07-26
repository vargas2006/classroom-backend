declare module 'apminsight' {
  interface AgentAPI {
    config(options?: any): void;
  }
  const agent: AgentAPI;
  export default agent;
}
