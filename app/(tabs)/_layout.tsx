import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Image } from 'react-native';
import { COLORS } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';

function TabIcon({ source, focused }: { source: any; focused: boolean }) {
  return (
    <Image
      source={source}
      style={{ width: 29, height: 29, opacity: focused ? 1 : 0.45 }}
      resizeMode="contain"
    />
  );
}

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface1,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: COLORS.purple2,
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ focused }) => (
            <TabIcon source={require('../../assets/images/menu/home.png')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: t('tabCollection'),
          tabBarIcon: ({ focused }) => (
            <TabIcon source={require('../../assets/images/menu/collection.png')} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: t('tabWishlist'),
          tabBarIcon: ({ focused }) => (
            <TabIcon source={require('../../assets/images/menu/wishlist.png')} focused={focused} />
          ),
        }}
      />
      {/* Aportes. El icono es un Ionicon PROVISIONAL: los otros cuatro son PNG
          propios en assets/images/menu/, y hasta que exista el quinto este va a
          desentonar un poco. Se cambia por <TabIcon source={...} /> en cuanto
          lo haya. */}
      <Tabs.Screen
        name="contributions"
        options={{
          title: t('tabContributions'),
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="add-circle"
              size={28}
              color={focused ? COLORS.purple2 : COLORS.textMuted}
              style={{ opacity: focused ? 1 : 0.7 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabProfile'),
          tabBarIcon: ({ focused }) => (
            <TabIcon source={require('../../assets/images/menu/profile.png')} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
