export type Messages = {
  brand: string;
  tagline: string;
  status: {
    title: string;
    web: string;
    api: string;
    ok: string;
    down: string;
    checking: string;
  };
  theme: { light: string; dark: string; toggle: string };
  language: { switchTo: string };
  phase: string;
  auth: {
    signIn: string;
    loginTitle: string;
    loginSubtitle: string;
    phone: string;
    phoneHint: string;
    password: string;
    showPassword: string;
    hidePassword: string;
    submit: string;
    submitting: string;
    logout: string;
    changeTitle: string;
    changeIntro: string;
    currentPassword: string;
    newPassword: string;
    repeatPassword: string;
    passwordRules: string;
    save: string;
    saving: string;
  };
  dashboard: {
    welcome: string;
    agency: string;
    role: string;
    plan: string;
    seats: string;
    roles: { manager: string; advisor: string };
    plans: { solo: string; small: string; large: string };
    comingSoon: string;
  };
  errors: {
    invalidCredentials: string;
    accountLocked: string;
    weakPassword: string;
    wrongPassword: string;
    mismatch: string;
    required: string;
    unavailable: string;
    generic: string;
  };
};
