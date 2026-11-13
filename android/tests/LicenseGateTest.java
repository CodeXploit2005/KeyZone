package com.keyzone.video;

public final class LicenseGateTest {
    static final String TOKEN="a".repeat(64), KEY="KZ-1234567890-ABCDEF";
    static final class Fixture implements LicenseGate.Storage,LicenseGate.Remote,LicenseGate.Clock {
        String saved="",lastAction="",lastCredential="";
        boolean network=true,save=true;
        long time=1000000,tick=1;
        int requests;
        LicenseGate.Reply reply=active();
        LicenseGate gate=new LicenseGate(this,this,this);
        LicenseGate.Reply active(){return new LicenseGate.Reply(true,"","Test","future",time+86400000,TOKEN);}
        public String device(){return "b".repeat(64);}
        public String token(){return saved;}
        public void token(String value)throws Exception{if(!save)throw new Exception("disk full");saved=value;}
        public LicenseGate.Reply request(String action,String device,String credential)throws Exception{
            requests++;lastAction=action;lastCredential=credential;
            check(device.equals("b".repeat(64)),"stable device sent");
            if(!network)throw new Exception("offline");return reply;
        }
        public long now(){return time;}
        public long elapsed(){return tick;}
        void advance(long millis){tick+=millis;time+=millis;}
    }
    interface Action {void run()throws Exception;}
    static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
    static void fails(Action action,String message)throws Exception{try{action.run();}catch(Exception expected){return;}throw new AssertionError(message);}
    public static void main(String[] args)throws Exception{
        Fixture f=new Fixture();
        check(!f.gate.status(false).valid&&f.requests==0,"unactivated app is locked without requests");
        fails(()->f.gate.requireValid(false),"bridge must deny use without a key");
        fails(()->f.gate.activate("short"),"invalid keys rejected locally");
        check(f.requests==0,"malformed key never sent");
        check(f.gate.activate("  "+KEY.toLowerCase()+"  ").valid,"valid key activates");
        check(f.saved.equals(TOKEN)&&f.lastCredential.equals(KEY),"only session persisted, normalized key sent");
        int count=f.requests;f.gate.requireValid(false);check(f.requests==count,"short cache prevents polling overload");
        f.reply=LicenseGate.Reply.denied("Key đã bị thu hồi.");f.advance(30001);
        check(!f.gate.status(false).valid,"revocation locks existing session after refresh interval");
        fails(()->f.gate.requireValid(false),"revoked bridge blocked");
        f.reply=f.active();check(f.gate.status(true).valid,"renewed server entitlement unlocks with saved session");
        f.network=false;check(!f.gate.status(true).valid,"network failure clears cached entitlement");
        fails(()->f.gate.requireValid(false),"offline protected action blocked");
        check(f.saved.equals(TOKEN),"transient outage keeps encrypted session for retry");
        f.network=true;check(f.gate.status(true).valid,"retry recovers after outage");
        f.time=f.reply.expires+1;check(!f.gate.status(false).valid,"expiry cannot stay unlocked in cache");
        f.reply=f.active();check(f.gate.status(true).valid,"server expiry extension works");
        f.network=false;fails(()->f.gate.deactivate(),"failed release must not discard token");
        check(f.saved.equals(TOKEN),"failed release keeps session");
        f.network=true;f.gate.deactivate();check(f.saved.isEmpty()&&!f.gate.status(false).valid,"release clears local grant");
        check(f.lastAction.equals("deactivate"),"release reaches license server");
        Fixture disk=new Fixture();disk.save=false;
        fails(()->disk.gate.activate(KEY),"activation cannot succeed if session cannot be saved");
        check(!disk.gate.status(false).valid,"storage failure stays locked");
        Fixture bad=new Fixture();bad.reply=new LicenseGate.Reply(true,"","Test","future",bad.time+10000,"bad");
        fails(()->bad.gate.activate(KEY),"malformed session rejected");
        check(bad.saved.isEmpty(),"malformed session never saved");
        bad.reply=new LicenseGate.Reply(true,"","Test","past",bad.time-1,TOKEN);
        fails(()->bad.gate.activate(KEY),"expired activation response rejected");
        Fixture restart=new Fixture();restart.saved=TOKEN;restart.network=false;
        check(!restart.gate.status(false).valid,"restart never trusts persisted token offline");
        System.out.println("PASS Android license: activation, device/session, invalid key, revocation, expiry, renewal, outage/retry, release, persistence failures, restart");
    }
}
