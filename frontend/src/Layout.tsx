import {
  AppBar,
  Box,
  Button,
  Chip,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import { Outlet, useNavigate } from "react-router-dom";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import PeopleIcon from "@mui/icons-material/People";
import { useCompetitions } from "@/competitions/useCompetitions";
import { useAuth } from "@/auth";

const drawerWidth = 240;

function RecentCompetitions() {
  const { competitions } = useCompetitions();
  if (!competitions || competitions.length === 0) return null;

  const recent = [...competitions]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 3);

  return (
    <>
      {recent.map((c) => (
        <ListItem key={c.name} disablePadding>
          <ListItemButton href={`/competitions/${c.name}`} sx={{ pl: 4 }}>
            <ListItemText
              primary={c.name}
              slotProps={{ primary: { variant: "body2" } }}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </>
  );
}

function AuthControls() {
  const { isModerator, username, logout } = useAuth();
  const navigate = useNavigate();

  if (isModerator) {
    return (
      <>
        <Chip
          label={username}
          variant="outlined"
          sx={{ color: "inherit", borderColor: "rgba(255,255,255,0.5)" }}
        />
        <Button color="inherit" onClick={logout}>
          Logout
        </Button>
      </>
    );
  }
  return (
    <Button color="inherit" onClick={() => navigate("/login")}>
      Login
    </Button>
  );
}

export default function Layout() {
  return (
    <Box sx={{ display: "flex" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            PetLom
          </Typography>
          <AuthControls />
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
          },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: "auto" }}>
          <List>
            <ListItem disablePadding>
              <ListItemButton href="/competitions">
                <ListItemIcon>
                  <EmojiEventsIcon />
                </ListItemIcon>
                <ListItemText primary="Competitions" />
              </ListItemButton>
            </ListItem>
            <RecentCompetitions />
            <ListItem disablePadding>
              <ListItemButton href="/players">
                <ListItemIcon>
                  <PeopleIcon />
                </ListItemIcon>
                <ListItemText primary="Players" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
