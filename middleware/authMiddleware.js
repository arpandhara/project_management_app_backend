import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";

const requireAuth = ClerkExpressRequireAuth({
  onError: (err, req, res) => {
    res.status(401).json({ error: "Unauthenticated: Please log in." });
  },
});

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const { sessionClaims, orgRole } = req.auth;

    // 👇 1. Determine the effective role
    // If we have an Org Role (org:admin / org:member), use it.
    // Otherwise, fall back to Personal Metadata (admin).
    const effectiveRole = orgRole || sessionClaims?.publicMetadata?.role || 'viewer';

    // 👇 2. Check if the role is in the allowed list
    if (!allowedRoles.includes(effectiveRole)) {
      return res.status(403).json({ 
        message: `Access Denied. Required: ${allowedRoles.join(' or ')}. You are: ${effectiveRole}` 
      });
    }

    next();
  };
};

export {
    requireAuth,
    requireRole
}