const ROLE_TIERS = {
    guest: ["basic"],
    basic: ["basic"],
    premium: ["basic", "premium"],
    vip: ["basic", "premium", "vip"],
    admin: ["basic", "premium", "vip"],
};

function getAllowedTiers(role = "guest") {
    return ROLE_TIERS[role] || ROLE_TIERS.guest;
}

function canUseDomain(role, domainTier) {
    return getAllowedTiers(role).includes(domainTier);
}

module.exports = {
    getAllowedTiers,
    canUseDomain,
};
