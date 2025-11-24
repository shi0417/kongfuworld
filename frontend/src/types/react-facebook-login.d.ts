declare module 'react-facebook-login' {
  import { Component } from 'react';

  interface FacebookLoginProps {
    appId: string;
    autoLoad?: boolean;
    fields?: string;
    callback: (response: any) => void;
    cssClass?: string;
    icon?: string;
    textButton?: string;
    buttonStyle?: React.CSSProperties;
    onFailure?: (response: any) => void;
    isDisabled?: boolean;
    language?: string;
    version?: string;
    cookie?: boolean;
    xfbml?: boolean;
    scope?: string;
    returnScopes?: boolean;
    size?: 'small' | 'medium' | 'metro';
    onClick?: () => void;
    isMobile?: boolean;
    disableMobileRedirect?: boolean;
    redirectUri?: string;
    state?: string;
    authType?: string;
    responseType?: string;
    onSuccess?: (response: any) => void;
    onFailure?: (response: any) => void;
  }

  export default class FacebookLogin extends Component<FacebookLoginProps> {}
}
