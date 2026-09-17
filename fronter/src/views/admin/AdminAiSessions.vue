<template>
  <section class="admin-panel" style="display:grid;gap:14px">
    <!-- 筛选：关键词（标题/用户名）+ 场景 -->
    <div class="filters">
      <label class="grow">
        {{ t('search') }}
        <input v-model="query.keyword" type="text" :placeholder="t('title')" />
      </label>
      <label>
        {{ t('type') }}
        <select v-model="query.scene">
          <option value="">{{ t('all') }}</option>
          <option value="student">{{ label('student') }}</option>
          <option value="admin">{{ label('admin') }}</option>
        </select>
      </label>
      <button class="btn ghost" type="button" @click="reset">{{ t('reset') }}</button>
    </div>

    <p v-if="actionError || error" class="alert error">{{ actionError || error }}</p>
    <p v-if="notice" class="alert success">{{ notice }}</p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>{{ t('title') }}</th>
            <th>{{ t('username') }}</th>
            <th>{{ t('type') }}</th>
            <th>{{ t('model') }}</th>
            <th>{{ t('messageCount') }}</th>
            <th>{{ t('createdAt') }}</th>
            <th>{{ t('lastActive') }}</th>
            <th>{{ t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td class="wrap">{{ row.title }}</td>
            <td>
              {{ row.username }}
              <span v-if="row.user_name" class="muted">· {{ row.user_name }}</span>
            </td>
            <td><span class="pill">{{ label(row.scene) }}</span></td>
            <td>{{ row.model }}</td>
            <td>{{ row.message_count }}</td>
            <td>{{ formatTime(row.created_at) }}</td>
            <td>{{ formatTime(row.updated_at) }}</td>
            <td>
              <div class="row-actions">
                <button class="btn ghost btn-sm" type="button" @click="openMessages(row)">{{ t('messages') }}</button>
                <button class="btn ghost danger btn-sm" type="button" @click="removeSession(row)">{{ t('delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length && !loading" class="muted">{{ t('empty') }}</p>
    </div>

    <Pagination
      :page="page"
      :page-size="size"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @page="changePage"
      @size="changePageSize"
    />

    <!-- 消息弹框：聊天气泡 + 弹框内独立分页 -->
    <AppModal v-model="messagesOpen" :title="t('messages')" size="lg">
      <p v-if="messagesError" class="alert error">{{ messagesError }}</p>

      <p v-if="messagesLoading && !messages.length" class="muted">{{ t('loading') }}</p>
      <div v-else class="chat">
        <div v-for="message in messages" :key="message.id" class="chat-line" :class="`chat-${message.role}`">
          <div class="chat-bubble">
            <p v-if="message.role === 'tool' && message.tool_name" class="muted chat-tool-name">{{ message.tool_name }}</p>
            <p class="chat-text">{{ message.content }}</p>
            <p v-if="messageMeta(message)" class="muted chat-meta">{{ messageMeta(message) }}</p>
          </div>
        </div>
        <p v-if="!messages.length" class="muted">{{ t('empty') }}</p>
      </div>

      <Pagination
        v-if="messagesTotal"
        style="margin-top:14px"
        :page="messagesPage"
        :page-size="MESSAGES_PAGE_SIZE"
        :total="messagesTotal"
        :total-pages="messagesTotalPages"
        :loading="messagesLoading"
        @page="changeMessagesPage"
        @size="changeMessagesSize"
      />

      <template #footer>
        <button class="btn ghost" type="button" @click="messagesOpen = false">{{ t('close') }}</button>
      </template>
    </AppModal>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { request, qs } from '../../api/client.js';
import { usePagedTable } from '../../composables/usePagedTable.js';
import Pagination from '../../components/Pagination.vue';
import AppModal from '../../components/AppModal.vue';
import { t, label } from '../../i18n/index.js';

const MESSAGES_PAGE_SIZE = 20;

const { rows, total, totalPages, loading, error, query, page, size, load, changePage, changePageSize, reset } =
  usePagedTable('/admin/ai/sessions', { filters: { keyword: '', scene: '' } });

const notice = ref('');
const actionError = ref('');

/** MySQL DATETIME 经 JSON 变成 ISO 串，按本地时间裁成 `YYYY-MM-DD HH:mm`。 */
function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 毫秒 → `1.2s` / `820ms`。 */
function formatLatency(ms) {
  const value = Number(ms) || 0;
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

/** 助手消息脚注：模型 · 耗时，缺哪项省哪项；其它角色没有脚注。 */
function messageMeta(message) {
  if (message.role !== 'assistant') return '';
  const parts = [];
  if (message.model) parts.push(message.model);
  if (message.latency_ms) parts.push(formatLatency(message.latency_ms));
  return parts.join(' · ');
}

// ---- 删除 ----
async function removeSession(row) {
  if (!window.confirm(t('deleteConfirm'))) return;
  notice.value = '';
  actionError.value = '';
  try {
    await request(`/admin/ai/sessions/${row.id}`, { method: 'DELETE' });
    notice.value = t('deleted');
    await load();
  } catch (err) {
    actionError.value = err.message;
  }
}

// ---- 消息弹框（分页状态独立于列表） ----
const messagesOpen = ref(false);
const messagesLoading = ref(false);
const messagesError = ref('');
const messages = ref([]);
const messagesPage = ref(1);
const messagesSize = ref(MESSAGES_PAGE_SIZE);
const messagesTotal = ref(0);
const messagesTotalPages = ref(1);
const activeSession = ref(null);

async function fetchMessages() {
  messagesLoading.value = true;
  messagesError.value = '';
  try {
    const data = await request(
      `/admin/ai/sessions/${activeSession.value.id}/messages${qs({ page: messagesPage.value, pageSize: messagesSize.value })}`
    );
    messages.value = data?.list ?? [];
    messagesTotal.value = data?.total ?? 0;
    messagesTotalPages.value = data?.totalPages ?? 1;
  } catch (err) {
    messagesError.value = err.message;
    messages.value = [];
    messagesTotal.value = 0;
    messagesTotalPages.value = 1;
  } finally {
    messagesLoading.value = false;
  }
}

function openMessages(row) {
  activeSession.value = row;
  messages.value = [];
  messagesError.value = '';
  messagesPage.value = 1;
  messagesOpen.value = true;
  return fetchMessages();
}

function changeMessagesPage(next) {
  messagesPage.value = Math.max(1, Math.min(next, messagesTotalPages.value || 1));
  return fetchMessages();
}

function changeMessagesSize(next) {
  messagesSize.value = Number(next) || MESSAGES_PAGE_SIZE;
  messagesPage.value = 1;
  return fetchMessages();
}
</script>

<style scoped>
/* 对话气泡：user 右、assistant 左、tool 居中系统提示 */
.chat { display: grid; gap: 10px; }
.chat-line { display: flex; }
.chat-user { justify-content: flex-end; }
.chat-tool { justify-content: center; }
.chat-bubble { max-width: 78%; border-radius: 10px; padding: 8px 10px; background: #f2f6fb; }
.chat-user .chat-bubble { background: #e8f1ff; }
.chat-tool .chat-bubble { max-width: 100%; background: transparent; padding: 0; text-align: center; }
.chat-text { margin: 0; white-space: pre-wrap; word-break: break-word; }
.chat-tool .chat-text { font-size: 12px; }
.chat-tool-name { margin: 0; font-size: 12px; }
.chat-meta { margin: 4px 0 0; font-size: 12px; }
</style>
