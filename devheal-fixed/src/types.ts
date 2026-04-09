export interface Issue {
  ruleId: string;
  category: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info" | "success";
  fixable: boolean;
  fixCommand?: string;
  fix?: FixAction;
}

export type FixAction = 
  | { type: "shell"; cmd: string; cwd?: string }
  | { type: "create-file"; path: string; content: string }
  | { type: "create-env-example" };

export interface ScanResult {
  issues: Issue[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
    fixable: number;
  };
  metadata: {
    scannedAt: string;
    cwd: string;
    elapsedMs: number;
    projectType: string;
    projectName: string;
  };
  system?: {
    os: string;
    arch: string;
    nodeTotalMemoryMB: number;
    shell: string;
    brew: string;
    deviceName: string;
  };
  rust?: any;
  go?: any;
  ruby?: any;
  java?: any;
  php?: any;
}

export interface DevHealPlugin {
  name: string;
  scan: (cwd: string) => Promise<any>;
  rules: (data: any) => Issue[];
}
