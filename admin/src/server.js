import app from './app.js';
import { aiConfig } from './config/ai.js';
import { logger } from './utils/logger.js';

// 兜底：任何漏网的异步异常只记录，不让单个坏请求打挂整个服务
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
});

const port = Number(process.env.PORT || 8033);
app.listen(port, () => {
  logger.info(`Chinese practice API running at http://localhost:${port}`);

  if (aiConfig.testModelIgnoredInProduction) {
    logger.warn('AI_TEST_MODEL is set but ignored: it only applies outside production', {
      testModel: process.env.AI_TEST_MODEL
    });
  }
  if (aiConfig.testModel) {
    logger.warn('AI_TEST_MODEL active — the agent will answer with a test model', {
      testModel: aiConfig.testModel,
      caveat: '小模型的聊天模板含 tools 段会被误判为支持工具调用，但它不会真的调用工具；'
        + '只对首轮意图预接地覆盖的 7 类数据问题仍然真实，自由问答与多轮工具调用会退化'
    });
  }
  if (!aiConfig.modelsDirFound) {
    logger.warn('Ollama models directory not found; the manifests fallback cannot work', {
      modelsDir: aiConfig.modelsDir,
      hint: '设置 OLLAMA_MODELS 指向真实目录，或确认 Ollama 服务已安装'
    });
  }
});
