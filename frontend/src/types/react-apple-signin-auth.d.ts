declare module 'react-apple-signin-auth' {
  import { Component } from 'react';

  interface AppleSigninProps {
    authOptions: {
      clientId: string;
      scope?: string;
      redirectURI?: string;
      state?: string;
      nonce?: string;
      usePopup?: boolean;
    };
    onSuccess?: (response: any) => void;
    onError?: (error: any) => void;
    render?: (props: any) => React.ReactElement;
  }

  export default class AppleSignin extends Component<AppleSigninProps> {}
}
