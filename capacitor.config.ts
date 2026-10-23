import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.miyukidesign.vtusong', // Apple Developer登録するBundle IDと合わせる
  appName: 'VTuSONG',
  webDir: 'dist',
  ios: { contentInset: 'automatic', preferredContentMode: 'mobile' },
}
export default config
