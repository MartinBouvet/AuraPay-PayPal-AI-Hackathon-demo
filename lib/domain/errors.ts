export class DomainError extends Error {
  readonly status: number;
  readonly issue: string;

  constructor(message: string, status: number, issue: string) {
    super(message);
    this.name = "DomainError";
    this.status = status;
    this.issue = issue;
  }
}
