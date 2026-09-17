<template>
  <section class="admin-panel stack">
    <!-- 工具栏 -->
    <div class="row">
      <button class="btn" type="button" @click="openCreate">{{ t('create') }}</button>
    </div>

    <!-- 筛选栏 -->
    <div class="filters">
      <label class="grow">
        {{ t('search') }}
        <input v-model="query.keyword" type="search" />
      </label>
      <label>
        {{ t('status') }}
        <select v-model="query.status">
          <option value="">{{ t('all') }}</option>
          <option value="active">{{ label('active') }}</option>
          <option value="disabled">{{ label('disabled') }}</option>
        </select>
      </label>
      <label>
        {{ t('sortOrder') }}
        <select v-model="query.sort">
          <option value="sort">{{ t('sortOrder') }}</option>
          <option value="id">{{ label('id') }}</option>
        </select>
      </label>
      <button class="btn ghost" type="button" @click="resetFilters()">{{ t('reset') }}</button>
    </div>

    <div v-if="error" class="alert error">{{ error }}</div>
    <div v-if="notice" class="alert success">{{ notice }}</div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ label('id') }}</th>
            <th>{{ t('code') }}</th>
            <th>{{ t('name') }}</th>
            <th>{{ t('description') }}</th>
            <th>{{ t('sortOrder') }}</th>
            <th>{{ t('status') }}</th>
            <th>{{ t('questionCount') }}</th>
            <th>{{ t('actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>{{ row.id }}</td>
            <td>{{ row.code }}</td>
            <td>{{ row.name }}</td>
            <td class="wrap">{{ row.description }}</td>
            <td>{{ row.sort_order }}</td>
            <td><span class="pill">{{ label(row.status) }}</span></td>
            <td>{{ row.question_count }}</td>
            <td>
              <div class="row-actions">
                <button class="btn ghost btn-sm" type="button" @click="openEdit(row)">{{ t('edit') }}</button>
                <button class="btn ghost danger btn-sm" type="button" @click="remove(row)">{{ t('delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="loading" class="muted">{{ t('loading') }}</p>
    <p v-else-if="!rows.length" class="muted">{{ t('empty') }}</p>

    <Pagination
      :page="page"
      :page-size="size"
      :total="total"
      :total-pages="totalPages"
      :loading="loading"
      @page="changePage"
      @size="changePageSize"
    />

    <AppModal v-model="modalOpen" :title="editing ? t('edit') : t('create')" size="lg">
      <div class="stack">
        <div v-if="formError" class="alert error">{{ formError }}</div>

        <!-- 标量字段 -->
        <div class="form-grid">
          <label>
            {{ t('code') }}
            <input v-model="form.code" type="text" />
          </label>
          <label>
            {{ t('sortOrder') }}
            <input v-model.number="form.sortOrder" type="number" min="0" />
          </label>
          <label>
            {{ t('status') }}
            <select v-model="form.status">
              <option value="active">{{ label('active') }}</option>
              <option value="disabled">{{ label('disabled') }}</option>
            </select>
          </label>
        </div>

        <!-- 三语内容：切 Tab 只切编辑区，提交时三个语言一起带上 -->
        <div>
          <p class="hint">{{ t('translations') }} · {{ activeLangLabel }}</p>
          <div class="lang-tabs">
            <button
              v-for="lang in LANGUAGES"
              :key="lang.code"
              type="button"
              :class="{ active: activeLang === lang.code }"
              @click="activeLang = lang.code"
            >
              {{ lang.label }}
            </button>
          </div>
          <div class="form-grid">
            <label class="field full">
              {{ t('name') }}
              <input v-model="form.translations[activeLang].name" type="text" />
            </label>
            <label class="field full">
              {{ t('description') }}
              <textarea v-model="form.translations[activeLang].description" rows="3"></textarea>
            </label>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="btn ghost" type="button" @click="modalOpen = false">{{ t('cancel') }}</button>
        <button class="btn" type="button" :disabled="saving" @click="submit">{{ t('save') }}</button>
      </template>
    </AppModal>
  </section>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { request } from '../../api/client.js';
import { usePagedTable } from '../../composables/usePagedTable.js';
import Pagination from '../../components/Pagination.vue';
import AppModal from '../../components/AppModal.vue';
import { t, label, LANGUAGES, state as i18nState } from '../../i18n/index.js';

/** 三语字段，与后端 level_translations 的列一一对应。 */
const FIELDS = ['name', 'description'];

const {
  rows, total, totalPages, loading, error, query, page, size,
  load, reset, changePage, changePageSize
} = usePagedTable('/admin/levels', {
  filters: { keyword: '', status: '', sort: 'sort', lang: i18nState.lang }
});

const modalOpen = ref(false);
const saving = ref(false);
const editing = ref(false);
const activeLang = ref('zh-CN');
const formError = ref('');
const notice = ref('');
let noticeTimer = null;

const activeLangLabel = computed(
  () => LANGUAGES.find((item) => item.code === activeLang.value)?.label ?? activeLang.value
);

const form = reactive({
  id: null,
  code: '',
  sortOrder: 0,
  status: 'active',
  translations: blankTranslations(FIELDS)
});

/** 三语空壳：三个语言分支始终存在，后端只 upsert 有内容的分支。 */
function blankTranslations(fields) {
  return Object.fromEntries(
    LANGUAGES.map(({ code }) => [code, Object.fromEntries(fields.map((field) => [field, '']))])
  );
}

/** 把接口返回的译文合并进空壳，避免只改中文时清掉英文 / 马来文。 */
function mergeTranslations(fields, loaded) {
  const merged = blankTranslations(fields);
  for (const { code } of LANGUAGES) {
    for (const field of fields) {
      const value = loaded?.[code]?.[field];
      if (value !== undefined && value !== null) merged[code][field] = value;
    }
  }
  return merged;
}

/** 列表展示语言跟随界面语言，只影响读取，不影响落库内容。 */
watch(() => i18nState.lang, (lang) => {
  if (query.lang !== lang) query.lang = lang;
});

function flash(text) {
  notice.value = text;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.value = ''; }, 3000);
}

/** 重置筛选时顺带把展示语言拉回当前界面语言（reset 会还原成进入页面时的值）。 */
function resetFilters() {
  reset();
  query.lang = i18nState.lang;
}

function resetForm() {
  Object.assign(form, {
    id: null,
    code: '',
    sortOrder: 0,
    status: 'active',
    translations: blankTranslations(FIELDS)
  });
  formError.value = '';
  activeLang.value = i18nState.lang;
}

function openCreate() {
  resetForm();
  editing.value = false;
  modalOpen.value = true;
}

async function openEdit(row) {
  resetForm();
  editing.value = true;
  modalOpen.value = true;
  try {
    const data = await request(`/admin/levels/${row.id}`);
    Object.assign(form, {
      id: data.id,
      code: data.code ?? '',
      sortOrder: data.sort_order ?? 0,
      status: data.status ?? 'active',
      translations: mergeTranslations(FIELDS, data.translations)
    });
  } catch (err) {
    formError.value = err.message;
  }
}

async function submit() {
  formError.value = '';
  if (!form.code.trim()) {
    formError.value = `${label('error')} · ${t('code')}`;
    return;
  }
  // 提交整份 translations（含全部三种语言），后端按语言 upsert，空的分支自动跳过
  const body = {
    code: form.code.trim(),
    sortOrder: Number(form.sortOrder) || 0,
    status: form.status,
    translations: form.translations
  };

  saving.value = true;
  try {
    if (editing.value) await request(`/admin/levels/${form.id}`, { method: 'PUT', body });
    else await request('/admin/levels', { method: 'POST', body });
    modalOpen.value = false;
    flash(t('saved'));
    await load();
  } catch (err) {
    formError.value = err.message;
  } finally {
    saving.value = false;
  }
}

async function remove(row) {
  if (!window.confirm(t('deleteConfirm'))) return;
  error.value = '';
  try {
    await request(`/admin/levels/${row.id}`, { method: 'DELETE' });
    flash(t('deleted'));
    await load();
  } catch (err) {
    // 409：等级下还有题目，直接把后端的说明显示出来
    error.value = err.message;
  }
}
</script>

<style scoped>
/* 现有样式表没有纵向间距工具类，这里补一层面板内部的堆叠布局 */
.stack { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
</style>
