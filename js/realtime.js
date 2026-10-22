// Supabase Realtime 채널 구독 (실시간 피드 / 라이드 이벤트)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** 활동 피드 구독: activity_events INSERT 이벤트 수신 */
export function subscribeFeed(onEvent) {
  return sb
    .channel('activity-feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_events' },
      (payload) => onEvent(payload.new),
    )
    .subscribe();
}

/** 라이드 상태 구독: rides 테이블의 INSERT/UPDATE/DELETE 수신 */
export function subscribeRideEvents(onEvent) {
  return sb
    .channel('ride-events')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rides' },
      (payload) => onEvent(payload.new, payload.eventType),
    )
    .subscribe();
}

/** 채널 해제 */
// Subscribe to offers (counter-offers) for a given task
export async function subscribeOffers(taskId, onOffer) {
  const channel = supabase
    .channel(`offers-${taskId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "offers", filter: `task_id=eq.${taskId}` },
      (payload) => onOffer(payload.new)
    )
    .subscribe();
  return channel;
}

// Publish a counter-offer back to the worker
export async function publishCounterOffer(offerId, newAmount) {
  const { data, error } = await supabase
    .from("offers")
    .update({
      counter_offer: newAmount,
      status: "countered",
    })
    .eq("id", offerId);
  if (error) throw error;
  return data;
}

export async function acceptOffer(offerId) {
  const { data, error } = await supabase
    .from("offers")
    .update({ status: "accepted" })
    .eq("id", offerId);
  if (error) throw error;
  // Update task status to matched
  // (In production: also atomically decline other offers)
  return data;
}

export async function declineOffer(offerId) {
  const { data, error } = await supabase
    .from("offers")
    .update({ status: "declined" })
    .eq("id", offerId);
  if (error) throw error;
  return data;
}

export function unsubscribe(channel) {
  sb.removeChannel(channel);
}