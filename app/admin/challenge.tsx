import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GalaxyBackground from '../../components/GalaxyBackground';
import GlassCard from '../../components/GlassCard';
import ScreenHeader from '../../components/ScreenHeader';
import { useAuth } from '../../hooks/useAuth';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { Challenge } from '../../lib/challenge';
import { COLORS } from '../../lib/constants';
import { useDialog } from '../../lib/DialogContext';
import { supabase } from '../../lib/supabase';

/**
 * Panel del Community Challenge (solo admin).
 *
 * Todo pasa por las RPC challenge_admin_*, que validan admin y estado en la
 * base: esta pantalla no escribe tablas directamente. Las acciones que cambian
 * el estado piden confirmacion. Textos solo en español: es una herramienta
 * interna, igual que la consola de notificaciones.
 */

type Overview = {
  eligible_cards: number; completed_cards: number; approved_images: number;
  pending_images: number; rejected_images: number; participants: number; active_voids: number;
};
type Standing = { rank: number; user_id: string; username: string | null; points: number; reached_at: string; tied: boolean };
type Contribution = {
  card_image_id: number; card_id: number; side: 'front' | 'back'; status: string;
  contributed_by: string; username: string | null; created_at: string; reviewed_at: string | null;
  rejection_reason: string | null; taken_down_at: string | null; scores: boolean;
};
type Void = { id: number; card_id: number; user_id: string; reason: string; voided_at: string; restored_at: string | null };
type Award = { position: number; user_id: string; premium_months: number; status: string; awarded_at: string };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', active: 'Recibiendo aportes', reviewing: 'Cerrado · revisando', finished: 'Finalizado',
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-CL') : '—');

export default function ChallengeAdminScreen() {
  const { userId } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin(userId);
  const { alert } = useDialog();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [voids, setVoids] = useState<Void[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [selectedUser, setSelectedUser] = useState<Standing | null>(null);
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    // La admin ve tambien borradores: se lee la tabla (la RLS se lo permite).
    const { data: ch } = await supabase.from('challenges').select('*').order('id', { ascending: false }).limit(1);
    const c = (ch?.[0] as Challenge) ?? null;
    setChallenge(c);
    if (c) {
      const [ov, st, vo, aw] = await Promise.all([
        supabase.rpc('challenge_admin_overview', { p_challenge_id: c.id }),
        supabase.rpc('challenge_admin_standings', { p_challenge_id: c.id }),
        supabase.from('challenge_point_voids').select('*').eq('challenge_id', c.id).order('voided_at', { ascending: false }),
        supabase.from('challenge_awards').select('*').eq('challenge_id', c.id).order('position'),
      ]);
      setOverview((Array.isArray(ov.data) ? ov.data[0] : ov.data) ?? null);
      setStandings((st.data ?? []) as Standing[]);
      setVoids((vo.data ?? []) as Void[]);
      setAwards((aw.data ?? []) as Award[]);
      setEndDate(c.ends_at ? c.ends_at.slice(0, 10) : '');
    }
    setLoading(false);
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const run = async (label: string, fn: () => PromiseLike<{ error: any }>, okMsg: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { alert(label, `No se pudo: ${error.message}`); return false; }
    alert(label, okMsg);
    await load();
    if (selectedUser) await openUser(selectedUser);
    return true;
  };

  const confirm = (title: string, message: string, onYes: () => void) =>
    alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: 'destructive', onPress: onYes },
    ]);

  const openUser = async (s: Standing) => {
    setSelectedUser(s);
    if (!challenge) return;
    const { data } = await supabase.rpc('challenge_admin_contributions', {
      p_challenge_id: challenge.id, p_user_id: s.user_id, p_limit: 200,
    });
    setContribs((data ?? []) as Contribution[]);
  };

  if (adminLoading || (isAdmin && loading)) {
    return (
      <SafeAreaView style={styles.container}>
        <GalaxyBackground />
        <ActivityIndicator style={{ marginTop: 80 }} color={COLORS.purple2} />
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <GalaxyBackground />
        <ScreenHeader title="Concurso" />
        <Text style={styles.muted}>Solo para administración.</Text>
      </SafeAreaView>
    );
  }

  const c = challenge;

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />
      <ScreenHeader title="Concurso · admin" fallback="/profile" />
      <ScrollView contentContainerStyle={styles.scroll}>

        {!c ? (
          <GlassCard style={styles.card}>
            <Text style={styles.h}>No hay concursos</Text>
            <Btn label="Crear Community Challenge (borrador)" disabled={busy} onPress={() =>
              run('Crear', () => supabase.rpc('challenge_admin_create', {
                p_slug: `community-challenge-${Date.now()}`, p_title: 'Community Challenge',
              }), 'Creado en borrador.')} />
          </GlassCard>
        ) : (
          <>
            {/* Estado y acciones */}
            <GlassCard style={styles.card}>
              <Text style={styles.h}>{c.title}</Text>
              <Line k="Estado" v={STATUS_LABEL[c.status]} />
              <Line k="Inicio" v={fmt(c.starts_at)} />
              <Line k="Cierre programado" v={c.ends_at ? fmt(c.ends_at) : 'Sin fecha (al completar)'} />
              <Line k="Cerrado" v={fmt(c.closed_at)} />
              <Line k="Finalizado" v={fmt(c.finalized_at)} />

              {(c.status === 'draft' || c.status === 'active') && (
                <View style={styles.inline}>
                  <TextInput
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="AAAA-MM-DD (vacío = sin fecha)"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                  <Btn small label="Guardar" disabled={busy} onPress={() => {
                    const v = endDate.trim();
                    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { alert('Fecha', 'Usa el formato AAAA-MM-DD.'); return; }
                    run('Fecha de cierre', () => supabase.rpc('challenge_admin_set_end', {
                      p_challenge_id: c.id, p_ends_at: v ? new Date(`${v}T23:59:59`).toISOString() : null,
                    }), 'Guardada.');
                  }} />
                </View>
              )}

              {c.status === 'draft' && (
                <Btn label="Activar (guarda el catálogo elegible)" disabled={busy} onPress={() =>
                  confirm('Activar concurso', 'Se guardan como elegibles todas las cards visibles AHORA y empieza a contar desde este momento.', () =>
                    run('Activar', () => supabase.rpc('challenge_admin_activate', { p_challenge_id: c.id }), 'Concurso activo.'))} />
              )}
              {c.status === 'active' && (
                <Btn label="Cerrar la carga" danger disabled={busy} onPress={() =>
                  confirm('Cerrar la carga', 'Desde ahora los aportes nuevos ya no suman. Los enviados antes se siguen revisando.', () =>
                    run('Cerrar', () => supabase.rpc('challenge_admin_close', { p_challenge_id: c.id }), 'Carga cerrada: en revisión.'))} />
              )}
              {c.status === 'reviewing' && (
                <>
                  <Btn label="Reabrir la carga" disabled={busy} onPress={() =>
                    confirm('Reabrir', 'Vuelve a recibir aportes. Úsalo solo si se cerró por error.', () =>
                      run('Reabrir', () => supabase.rpc('challenge_admin_reopen', { p_challenge_id: c.id }), 'Reabierto.'))} />
                  <Btn label="Finalizar y publicar ganadoras" danger disabled={busy} onPress={() =>
                    confirm('Finalizar', 'Congela el ranking y registra los premios. NO se puede deshacer. Debe no quedar nada pendiente del período.', () =>
                      run('Finalizar', () => supabase.rpc('challenge_admin_finalize', { p_challenge_id: c.id }), 'Resultados publicados.'))} />
                </>
              )}
            </GlassCard>

            {/* Resumen */}
            {overview && (
              <GlassCard style={styles.card}>
                <Text style={styles.h}>Resumen</Text>
                <Line k="Cards completadas" v={`${overview.completed_cards} / ${overview.eligible_cards}`} />
                <Line k="Imágenes aprobadas" v={String(overview.approved_images)} />
                <Line k="Imágenes pendientes" v={String(overview.pending_images)} />
                <Line k="Imágenes rechazadas" v={String(overview.rejected_images)} />
                <Line k="Participantes" v={String(overview.participants)} />
                <Line k="Puntos anulados vigentes" v={String(overview.active_voids)} />
                {overview.pending_images > 0 && (
                  <Text style={styles.hint}>Las pendientes se moderan en Moderación, como siempre.</Text>
                )}
              </GlassCard>
            )}

            {/* Premios */}
            {awards.length > 0 && (
              <GlassCard style={styles.card}>
                <Text style={styles.h}>Premios registrados</Text>
                {awards.map(a => (
                  <Line key={a.position} k={`${a.position}° · ${a.premium_months} meses`}
                    v={`@${standings.find(s => s.user_id === a.user_id)?.username ?? a.user_id.slice(0, 8)} · ${a.status}`} />
                ))}
                <Text style={styles.hint}>Quedan en “pending_activation” hasta que se lance Premium.</Text>
              </GlassCard>
            )}

            {/* Ranking */}
            <GlassCard style={styles.card}>
              <Text style={styles.h}>Ranking en vivo</Text>
              {standings.length === 0 && <Text style={styles.muted}>Aún nadie suma puntos.</Text>}
              {standings.map(s => (
                <TouchableOpacity key={s.user_id} onPress={() => openUser(s)} style={styles.standing}>
                  <Text style={styles.rank}>{s.rank}.</Text>
                  <Text style={styles.user} numberOfLines={1}>@{s.username ?? s.user_id.slice(0, 8)}</Text>
                  {s.tied && <Text style={styles.tie}>empate</Text>}
                  <Text style={styles.pts}>{s.points} pts</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
              {standings.some(s => s.tied) && (
                <Text style={styles.hint}>En empate de puntos gana quien llegó antes (fecha de envío de su último punto): ya está aplicado en el orden.</Text>
              )}
            </GlassCard>

            {/* Aportes de una usuaria */}
            {selectedUser && (
              <GlassCard style={styles.card}>
                <Text style={styles.h}>Aportes de @{selectedUser.username ?? selectedUser.user_id.slice(0, 8)}</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Motivo (obligatorio para anular)"
                  placeholderTextColor={COLORS.textMuted}
                  style={[styles.input, { marginBottom: 8 }]}
                />
                {contribs.map(x => (
                  <View key={x.card_image_id} style={styles.contrib}>
                    <Text style={styles.contribText}>
                      Card {x.card_id} · {x.side === 'front' ? 'frente' : 'reverso'} · {x.taken_down_at ? 'retirada' : x.status}
                      {x.scores ? ' · ✅ suma' : ''}
                    </Text>
                    <Text style={styles.contribDate}>enviado {fmt(x.created_at)}</Text>
                    {x.scores && x.side === 'front' && (c.status === 'active' || c.status === 'reviewing') && (
                      <Btn small danger label="Anular punto" disabled={busy || !reason.trim()} onPress={() =>
                        confirm('Anular punto', `Card ${x.card_id} deja de sumar para esta usuaria. Queda registrado y se puede restaurar.`, () =>
                          run('Anular', () => supabase.rpc('challenge_admin_void_point', {
                            p_challenge_id: c.id, p_card_id: x.card_id, p_user_id: x.contributed_by, p_reason: reason.trim(),
                          }), 'Punto anulado.'))} />
                    )}
                  </View>
                ))}
              </GlassCard>
            )}

            {/* Anulaciones (auditoria) */}
            {voids.length > 0 && (
              <GlassCard style={styles.card}>
                <Text style={styles.h}>Anulaciones</Text>
                {voids.map(v => (
                  <View key={v.id} style={styles.contrib}>
                    <Text style={styles.contribText}>
                      Card {v.card_id} · {v.reason} · {v.restored_at ? `restaurada ${fmt(v.restored_at)}` : 'vigente'}
                    </Text>
                    <Text style={styles.contribDate}>{fmt(v.voided_at)}</Text>
                    {!v.restored_at && (c.status === 'active' || c.status === 'reviewing') && (
                      <Btn small label="Restaurar" disabled={busy || !reason.trim()} onPress={() =>
                        run('Restaurar', () => supabase.rpc('challenge_admin_restore_point', {
                          p_void_id: v.id, p_reason: reason.trim(),
                        }), 'Punto restaurado.')} />
                    )}
                  </View>
                ))}
              </GlassCard>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

function Btn({ label, onPress, disabled, danger, small }: {
  label: string; onPress: () => void; disabled?: boolean; danger?: boolean; small?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={[styles.btn, danger && styles.btnDanger, small && styles.btnSmall, disabled && { opacity: 0.4 }]}
    >
      <Text style={[styles.btnText, small && { fontSize: 12 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 16, paddingBottom: 80, gap: 12 },
  card: { padding: 16, gap: 4 },
  h: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 6 },
  muted: { color: COLORS.textMuted, textAlign: 'center', marginTop: 10 },
  hint: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 3 },
  k: { fontSize: 12, color: COLORS.textSecondary },
  v: { fontSize: 12, fontWeight: '700', color: '#fff', flexShrink: 1, textAlign: 'right' },
  inline: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, color: '#fff', fontSize: 13,
    backgroundColor: COLORS.surfaceGlass,
  },
  btn: {
    marginTop: 10, paddingVertical: 11, borderRadius: 12, alignItems: 'center',
    backgroundColor: COLORS.purple1,
  },
  btnDanger: { backgroundColor: '#9d1f5f' },
  btnSmall: { marginTop: 6, paddingVertical: 7, paddingHorizontal: 12, alignSelf: 'flex-start' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  standing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  rank: { width: 26, color: COLORS.textSecondary, fontWeight: '800' },
  user: { flex: 1, color: '#fff', fontWeight: '700' },
  tie: { fontSize: 10, color: COLORS.gold, fontWeight: '800' },
  pts: { color: COLORS.purple3, fontWeight: '800' },
  contrib: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  contribText: { color: '#fff', fontSize: 12 },
  contribDate: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
});
