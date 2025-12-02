import { ClerkExpressRequireAuth } from "@clerk/clerk-sdk-node";

const requireAuth = ClerkExpressRequireAuth({
  onError: (err, req, res) => {
    res.status(401).json({ error: "Unauthenticated: Please log in." });
  },
});

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const { sessionClaims } = req.auth;

    const userRole = sessionClaims?.publicMetadata?.role || 'viewer'; 

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: `Access Denied. Required role: ${allowedRoles.join(' or ')}` 
      });
    }

    next();
  };
};

export {
    requireAuth,
    requireRole
}
