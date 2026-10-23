export const SESSION_STORAGE_KEYS = [
  'token',
  'SessionId',
  'UserName',
  'AgentId',
  'RoleId',
  'DatabaseName',
  'ArtaxPortalToken',
  'ArtaxPortalSessionId',
  'ArtaxPortalUserName',
  'ArtaxPortalName',
  'ArtaxPortalClientCode'
];

export const getSessionItem = (key) => sessionStorage.getItem(key);

export const setSessionItem = (key, value) => {
  if (value !== undefined && value !== null) {
    sessionStorage.setItem(key, value);
  }
};

export const clearSessionItems = () => {
  SESSION_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
};
