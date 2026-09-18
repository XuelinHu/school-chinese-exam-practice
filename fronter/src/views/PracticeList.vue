<template>
  <section>
    <h1>{{ t('practice') }}</h1>
    <div class="grid">
      <router-link v-for="paper in rows" :key="paper.id" class="card" :to="`/practice/${paper.id}`">
        <h3>{{ paper.title }}</h3>
        <p class="muted">{{ paper.description }}</p>
        <div class="row">
          <span class="pill">{{ paper.level_name }}</span>
          <span class="pill">{{ t('questionCount') }}: {{ paper.question_count }}</span>
          <span class="pill">{{ t('score') }}: {{ paper.total_score }}</span>
        </div>
      </router-link>
    </div>
    <p v-if="error" class="alert error" style="margin-top: 12px">{{ error }}</p>
    <p v-if="!rows.length && !loading" class="muted">{{ t('empty') }}</p>

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
  </section>
</template>

<script setup>
import { usePagedTable } from '../composables/usePagedTable.js';
import Pagination from '../components/Pagination.vue';
import { state, t } from '../i18n/index.js';

// lang 走 extra 而不是 filters：切语言时自动重查，且不会被 reset() 回滚成旧语言
const { rows, total, totalPages, loading, error, page, size, changePage, changePageSize } =
  usePagedTable('/learning/papers', {
    pageSize: 12, // 卡片布局，一页 12 张刚好铺满
    extra: () => ({ lang: state.lang })
  });
</script>
