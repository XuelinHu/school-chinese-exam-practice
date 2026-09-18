<template>
  <section>
    <h1>{{ t('teaching') }}</h1>
    <p class="muted">{{ t('teachingHint') }}</p>

    <div class="admin-panel" style="margin-top: 12px">
      <div class="filters">
        <label class="grow">
          {{ t('search') }}
          <input v-model="query.keyword" :placeholder="t('username')" />
        </label>
        <label>
          {{ t('level') }}
          <select v-model="query.levelId">
            <option value="">{{ t('all') }}</option>
            <option v-for="item in levels" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select>
        </label>
        <label>
          {{ t('status') }}
          <select v-model="query.status">
            <option value="">{{ t('all') }}</option>
            <option value="active">{{ label('active') }}</option>
            <option value="disabled">{{ label('disabled') }}</option>
          </select>
        </label>
        <button class="btn ghost" type="button" @click="reset">{{ t('reset') }}</button>
      </div>

      <p v-if="error" class="alert error" style="margin-top: 12px">{{ error }}</p>

      <div class="table-wrap" style="margin-top: 12px">
        <table>
          <thead>
            <tr>
              <th>{{ t('studentNo') }}</th>
              <th>{{ t('name') }}</th>
              <th>{{ t('username') }}</th>
              <th>{{ t('nationality') }}</th>
              <th>{{ t('status') }}</th>
              <th>{{ t('recordCount') }}</th>
              <th>{{ t('avgScore') }}</th>
              <th>{{ t('unresolvedWrong') }}</th>
              <th>{{ t('lastActive') }}</th>
              <th>{{ t('actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>{{ row.student_no }}</td>
              <td>{{ row.name }}</td>
              <td>{{ row.username }}</td>
              <td>{{ row.nationality }}</td>
              <td><span class="pill">{{ label(row.status) }}</span></td>
              <td>{{ row.record_count }}</td>
              <td>{{ row.avg_score }}</td>
              <td>{{ row.unresolved_wrong }}</td>
              <td>{{ fmtTime(row.last_active_at) }}</td>
              <td>
                <router-link class="btn ghost btn-sm" :to="`/teaching/${row.id}`">
                  {{ t('viewDetail') }}
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!rows.length && !loading" class="muted">{{ t('empty') }}</p>
      </div>

      <Pagination
        style="margin-top: 12px"
        :page="page"
        :page-size="size"
        :total="total"
        :total-pages="totalPages"
        :loading="loading"
        @page="changePage"
        @size="changePageSize"
      />
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { request } from '../api/client.js';
import { usePagedTable } from '../composables/usePagedTable.js';
import Pagination from '../components/Pagination.vue';
import { state, t, label } from '../i18n/index.js';
import { fmtTime } from '../utils/format.js';

const { rows, total, totalPages, loading, error, query, page, size, reset, changePage, changePageSize } =
  usePagedTable('/teaching/students', {
    // levelId 走「练过该等级试卷」的语义，由后端 EXISTS 解释
    filters: { keyword: '', status: '', levelId: '' },
    extra: () => ({ lang: state.lang })
  });

// 等级下拉的数据源。拉不到就少一个筛选项，不该挡住学员列表本身
const levels = ref([]);

async function loadLevels() {
  try {
    levels.value = await request(`/learning/levels?lang=${state.lang}`);
  } catch {
    levels.value = [];
  }
}

onMounted(loadLevels);
// 等级名是三语字段，切换语言后下拉里的名字也要跟着变
watch(() => state.lang, loadLevels);
</script>
