export interface DeployStep {
  step: string;
  title: string;
  cmd: string;
  time: string;
}

export interface FarmInfo {
  name: string;
  location: string;
  badge: string;
  specs: string;
  sourceNote: string;
}

export interface NavAction {
  label: string;
  onClick: () => void;
  ariaLabel: string;
  className?: string;
}