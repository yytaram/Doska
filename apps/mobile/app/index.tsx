import { Redirect } from 'expo-router';

import { CenteredScreen } from '../src/components/screen';
import { LoadingView } from '../src/components/ui';
import { useAuthStore } from '../src/auth/store';

export default function IndexScreen() {
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') {
    return (
      <CenteredScreen>
        <LoadingView />
      </CenteredScreen>
    );
  }

  return <Redirect href={status === 'signedIn' ? '/home' : '/welcome'} />;
}
