import MyContributionsScreen from '../../components/MyContributionsScreen';

/** Pestaña "Aportes": oculta mientras CARD_SUBMISSIONS_ENABLED este apagado. */
export default function ContributionsTab() {
  return <MyContributionsScreen variant="tab" />;
}
