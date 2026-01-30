/**
 * LLMux - Evaluation API Routes
 * Admin endpoints for viewing metrics and managing weights
 */

const express = require('express');
const router = express.Router();

const shadowRouter = require('../routing/shadow');
const judgeService = require('../evaluation/judge');
const metricsCollector = require('../evaluation/metrics_collector');
const weightOptimizer = require('../routing/weight_optimizer');

/**
 * GET /api/evaluation/metrics
 * View current performance metrics
 */
router.get('/metrics', (req, res) => {
    const { provider, taskType } = req.query;

    if (provider) {
        const metrics = metricsCollector.getMetrics(provider, taskType || 'ALL');
        return res.json({
            provider,
            taskType: taskType || 'ALL',
            metrics
        });
    }

    // All providers
    const allMetrics = metricsCollector.getAllMetrics();
    res.json({
        totalEvaluations: metricsCollector.getTotalCount(),
        providers: allMetrics
    });
});

/**
 * GET /api/evaluation/weights
 * View current dynamic weights
 */
router.get('/weights', (req, res) => {
    const weights = weightOptimizer.getWeights();
    const status = weightOptimizer.getStatus();

    res.json({
        current: weights,
        status
    });
});

/**
 * POST /api/evaluation/weights/reset
 * Reset weights to config defaults
 */
router.post('/weights/reset', (req, res) => {
    weightOptimizer.resetWeights();
    res.json({
        success: true,
        weights: weightOptimizer.getWeights()
    });
});

/**
 * POST /api/evaluation/weights/update
 * Manually trigger weight update
 */
router.post('/weights/update', async (req, res) => {
    await weightOptimizer.updateWeights();
    res.json({
        success: true,
        weights: weightOptimizer.getWeights(),
        status: weightOptimizer.getStatus()
    });
});

/**
 * GET /api/evaluation/comparisons
 * View recent shadow comparisons (pending judge)
 */
router.get('/comparisons', (req, res) => {
    const queueSize = shadowRouter.getQueueSize();
    res.json({
        queueSize,
        status: shadowRouter.enabled ? 'enabled' : 'disabled',
        rate: shadowRouter.rate
    });
});

/**
 * POST /api/evaluation/judge/batch
 * Manually trigger judge evaluation of pending comparisons
 */
router.post('/judge/batch', async (req, res) => {
    const limit = parseInt(req.query.limit || '10');

    const comparisons = shadowRouter.getComparisons(limit);
    if (comparisons.length === 0) {
        return res.json({
            success: true,
            processed: 0,
            message: 'No pending comparisons'
        });
    }

    const results = await judgeService.evaluateBatch(comparisons);

    // Record metrics
    for (const result of results) {
        metricsCollector.record(result);
    }

    res.json({
        success: true,
        processed: results.length,
        results: results.map(r => ({
            requestId: r.requestId,
            primary: r.primary.provider,
            shadow: r.shadow.provider,
            winner: r.evaluation.winner,
            scores: r.evaluation.scores
        }))
    });
});

/**
 * GET /api/evaluation/status
 * Overall system status
 */
router.get('/status', (req, res) => {
    res.json({
        shadow: {
            enabled: shadowRouter.enabled,
            rate: shadowRouter.rate,
            queueSize: shadowRouter.getQueueSize()
        },
        judge: {
            enabled: judgeService.enabled,
            provider: judgeService.judgeProvider,
            model: judgeService.judgeModel
        },
        optimizer: weightOptimizer.getStatus(),
        metrics: {
            totalEvaluations: metricsCollector.getTotalCount()
        }
    });
});

module.exports = router;
