/* ====================================================
   FINANCIAL INTELLIGENCE & CURRENCY UTILITIES
   ==================================================== */

const currencyConfigs = {
  USD: { locale: 'en-US', currency: 'USD', symbol: '$' },
  EUR: { locale: 'de-DE', currency: 'EUR', symbol: '€' },
  GBP: { locale: 'en-GB', currency: 'GBP', symbol: '£' },
  JPY: { locale: 'ja-JP', currency: 'JPY', symbol: '¥' },
  INR: { locale: 'en-IN', currency: 'INR', symbol: '₹' },
  AUD: { locale: 'en-AU', currency: 'AUD', symbol: 'A$' },
  CAD: { locale: 'en-CA', currency: 'CAD', symbol: 'C$' }
};

// Formats a raw number according to the selected country currency
export function formatCurrency(amount, currencyCode = 'USD') {
  const cfg = currencyConfigs[currencyCode] || currencyConfigs.USD;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.currency,
    minimumFractionDigits: cfg.currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: cfg.currency === 'JPY' ? 0 : 2
  }).format(amount);
}

// Retrieves the symbol character for a currency (e.g. $, €, ₹)
export function getCurrencySymbol(currencyCode = 'USD') {
  return currencyConfigs[currencyCode]?.symbol || '$';
}

// Generates intelligence alerts based on current state parameters
export function generateSmartInsights(goals, currencyCode = 'USD') {
  if (!goals || goals.length === 0) {
    return [
      {
        icon: '💡',
        text: 'Add your first savings goal in the header to get smart insights!',
        type: 'info'
      }
    ];
  }

  const insights = [];
  let totalRemaining = 0;
  let totalMonthlyAllocation = 0;
  let activeGoalsCount = 0;

  const today = new Date();

  goals.forEach(goal => {
    const remaining = Math.max(0, goal.target - goal.current);
    const deadlineDate = new Date(goal.deadline);
    const timeDiff = deadlineDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    const monthsDiff = daysDiff / 30.4;

    if (remaining === 0) {
      insights.push({
        icon: '🎉',
        text: `Goal <strong>${goal.name}</strong> is fully funded! Excellent work.`,
        type: 'success',
        meta: 'Goal Completed'
      });
      return;
    }

    activeGoalsCount++;
    totalRemaining += remaining;

    if (daysDiff <= 0) {
      insights.push({
        icon: '⚠️',
        text: `Goal <strong>${goal.name}</strong> has passed its target deadline of ${new Date(goal.deadline).toLocaleDateString()}. Consider updating the date to keep tracking.`,
        type: 'warning',
        meta: 'Deadline Passed'
      });
    } else {
      // Calculate monthly and daily paces
      const monthsNeeded = Math.max(0.1, monthsDiff);
      const monthlyRate = remaining / monthsNeeded;
      const dailyRate = remaining / daysDiff;

      totalMonthlyAllocation += monthlyRate;

      // Make a clean readable deadline month name
      const deadlineName = deadlineDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      insights.push({
        icon: '📅',
        text: `To achieve <strong>${goal.name}</strong> by ${deadlineName}, save <strong>${formatCurrency(monthlyRate, currencyCode)}/month</strong> (approx. ${formatCurrency(dailyRate, currencyCode)}/day).`,
        type: 'info',
        meta: `${daysDiff} days remaining`
      });
    }
  });

  // Global summary insight
  if (activeGoalsCount > 1 && totalMonthlyAllocation > 0) {
    insights.unshift({
      icon: '💡',
      text: `To complete all your ${activeGoalsCount} in-progress goals on schedule, your combined budget target is <strong>${formatCurrency(totalMonthlyAllocation, currencyCode)}/month</strong>.`,
      type: 'summary',
      meta: `Total savings deficit: ${formatCurrency(totalRemaining, currencyCode)}`
    });
  }

  return insights;
}
