#pragma once

#include <windows.h>
#include <winhttp.h>
#include <objidl.h>
#include <gdiplus.h>
#include <shlwapi.h>
#include <array>
#include <algorithm>
#include <chrono>
#include <future>
#include <fstream>
#include <cstdint>
#include <cstring>
#include <ctime>
#include <cmath>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#pragma comment(lib, "Gdiplus.lib")
#pragma comment(lib, "Shlwapi.lib")

namespace WeatherOverlay {
using Clock=std::chrono::steady_clock;
using Bytes=std::vector<unsigned char>;
constexpr double West=-81.5, South=42.25, East=-77.5, North=45.25;
enum Layer { Rain=1, Lightning=2, Vertical=4 };
inline constexpr double CenterLat=43.6777,CenterLon=-79.6248,Pi=3.14159265358979323846;
inline std::pair<double,double> RangePoint(double rangeNm,double bearing){
    const double lat=CenterLat*Pi/180,lon=CenterLon*Pi/180,d=rangeNm/3440.065;
    const double y=std::asin(std::sin(lat)*std::cos(d)+std::cos(lat)*std::sin(d)*std::cos(bearing));
    const double x=lon+std::atan2(std::sin(bearing)*std::sin(d)*std::cos(lat),std::cos(d)-std::sin(lat)*std::sin(y));
    return {y*180/Pi,x*180/Pi};
}
inline constexpr int GridWidth=400, GridHeight=300;
inline std::uint32_t EchoPixel(unsigned value) {
    if(!value||value>200)return 0;
    // 0.5 dBZ units; strong echoes are brighter and less transparent.
    if(value>=90)return 0xb87aff65;
    if(value>=60)return 0x8030d34c;
    return 0x4d16a641;
}
inline std::unique_ptr<Gdiplus::Bitmap> LightningPixels(Gdiplus::Image& source){
    auto image=std::make_unique<Gdiplus::Bitmap>(512,512,PixelFormat32bppARGB);
    {Gdiplus::Graphics g(image.get());g.Clear(Gdiplus::Color(0,0,0,0));g.SetCompositingMode(Gdiplus::CompositingModeSourceCopy);
     if(g.DrawImage(&source,0,0,512,512)!=Gdiplus::Ok)return {};}
    Gdiplus::BitmapData bits{};Gdiplus::Rect area(0,0,512,512);
    if(image->LockBits(&area,Gdiplus::ImageLockModeRead|Gdiplus::ImageLockModeWrite,PixelFormat32bppARGB,&bits)!=Gdiplus::Ok)return {};
    for(int y=0;y<512;y++){
        auto* row=reinterpret_cast<std::uint32_t*>(static_cast<char*>(bits.Scan0)+y*bits.Stride);
        for(int x=0;x<512;x++){
            const auto p=row[x];const unsigned r=(p>>16)&255,g=(p>>8)&255,b=p&255;
            row[x]=std::max({r,g,b})-std::min({r,g,b})>20?(p&0xff000000)|0x00ffe868:0;
        }
    }
    image->UnlockBits(&bits);return image;
}
inline Bytes Fetch(const wchar_t* layer){
    struct Handle { HINTERNET value; ~Handle(){if(value)WinHttpCloseHandle(value);} };
    Handle session{WinHttpOpen(L"ZYZTools Weather/1",WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,nullptr,nullptr,0)};
    if(!session.value)return {};
    WinHttpSetTimeouts(session.value,3000,3000,4000,4000);
    Handle server{WinHttpConnect(session.value,L"geo.weather.gc.ca",INTERNET_DEFAULT_HTTPS_PORT,0)};
    if(!server.value)return {};
    std::wstring url=L"/geomet?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&CRS=CRS:84&BBOX=-81.5,42.25,-77.5,45.25&WIDTH=512&HEIGHT=512&FORMAT=image/png&TRANSPARENT=TRUE&STYLES=&LAYERS=";
    url+=layer;
    Handle request{WinHttpOpenRequest(server.value,L"GET",url.c_str(),nullptr,nullptr,nullptr,WINHTTP_FLAG_SECURE)};
    if(!request.value)return {};
    DWORD redirect=WINHTTP_OPTION_REDIRECT_POLICY_NEVER;
    WinHttpSetOption(request.value,WINHTTP_OPTION_REDIRECT_POLICY,&redirect,sizeof redirect);
    if(!WinHttpSendRequest(request.value,nullptr,0,nullptr,0,0,0)||!WinHttpReceiveResponse(request.value,nullptr))return {};
    DWORD status=0,size=sizeof status;
    if(!WinHttpQueryHeaders(request.value,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,nullptr,&status,&size,nullptr)||status!=200)return {};
    Bytes data;std::array<unsigned char,8192> buffer;DWORD count=0;
    const auto deadline=Clock::now()+std::chrono::seconds(12);
    do{
        if(Clock::now()>deadline||!WinHttpReadData(request.value,buffer.data(),static_cast<DWORD>(buffer.size()),&count))return {};
        data.insert(data.end(),buffer.begin(),buffer.begin()+count);
        if(data.size()>2*1024*1024)return {};
    }while(count);
    constexpr std::array<unsigned char,8> png{137,80,78,71,13,10,26,10};
    if(data.size()<24||!std::equal(png.begin(),png.end(),data.begin()))return {};
    // Accept only the requested dimensions before handing bytes to the decoder.
    if(data[16]||data[17]||data[18]!=2||data[19]||data[20]||data[21]||data[22]!=2||data[23])return {};
    return data;
}
class Overlay {
    struct Frame{
        IStream* stream=nullptr;
        std::unique_ptr<Gdiplus::Image> image;
        std::future<Bytes> pending;
        Clock::time_point next{},received{};
        void Clear(){image.reset();if(stream){stream->Release();stream=nullptr;}}
        ~Frame(){Clear();}
    };
    std::array<Frame,3> frames;
    ULONG_PTR gdip=0;
    std::unique_ptr<Gdiplus::Bitmap> echo;
    std::uint64_t observed=0;
    Clock::time_point nextGrid{};
    int currentHeight=0,currentMode=-1;
    void LoadGrid(const std::string& folder,int height,int mode,Clock::time_point now){
        if(currentHeight!=height||currentMode!=mode){echo.reset();observed=0;nextGrid={};currentHeight=height;currentMode=mode;}
        if(now<nextGrid)return;
        nextGrid=now+std::chrono::seconds(2);
        std::ifstream f(folder+"RadarReflectivity.bin",std::ios::binary);
        char header[20];
        if(!f.read(header,sizeof header)||std::memcmp(header,"WXG2",4))return;
        std::uint32_t h=0,m=0;std::uint64_t timestamp=0;
        std::memcpy(&h,header+4,4);std::memcpy(&timestamp,header+8,8);std::memcpy(&m,header+16,4);
        if(h!=static_cast<unsigned>(height)||m!=static_cast<unsigned>(mode)||timestamp==observed||!Fresh(timestamp))return;
        Bytes values(GridWidth*GridHeight);
        if(!f.read(reinterpret_cast<char*>(values.data()),values.size())||f.peek()!=EOF)return;
        auto image=std::make_unique<Gdiplus::Bitmap>(GridWidth,GridHeight,PixelFormat32bppARGB);
        Gdiplus::BitmapData bits{};
        Gdiplus::Rect area(0,0,GridWidth,GridHeight);
        if(image->LockBits(&area,Gdiplus::ImageLockModeWrite,PixelFormat32bppARGB,&bits)!=Gdiplus::Ok)return;
        for(int y=0;y<GridHeight;y++){
            auto* row=reinterpret_cast<std::uint32_t*>(static_cast<char*>(bits.Scan0)+y*bits.Stride);
            for(int x=0;x<GridWidth;x++)row[x]=EchoPixel(values[y*GridWidth+x]);
        }
        image->UnlockBits(&bits);echo=std::move(image);observed=timestamp;
    }
    static bool Fresh(std::uint64_t ms){
        const auto now=static_cast<std::uint64_t>(std::time(nullptr))*1000;
        return ms&&ms<=now+120000&&now<=ms+15*60000;
    }
public:
    ~Overlay(){echo.reset();for(auto& f:frames)f.Clear();if(gdip)Gdiplus::GdiplusShutdown(gdip);}
    template<class Project>
    void Draw(HDC dc,const RECT& clip,int mask,int height,int mode,int rangeNm,const std::string& folder,Project project){
        if(!mask)return;
        if(!gdip){Gdiplus::GdiplusStartupInput input;if(Gdiplus::GdiplusStartup(&gdip,&input,nullptr)!=Gdiplus::Ok)return;}
        const auto now=Clock::now();
        const auto a=project(North,West),b=project(North,East),c=project(South,West);
        Gdiplus::Point points[]={{int(a.x),int(a.y)},{int(b.x),int(b.y)},{int(c.x),int(c.y)}};
        Gdiplus::Graphics graphics(dc);
        graphics.SetClip(Gdiplus::Rect(clip.left,clip.top,clip.right-clip.left,clip.bottom-clip.top));
        std::array<Gdiplus::Point,120> rangeBoundary;
        for(size_t i=0;i<rangeBoundary.size();i++){
            const auto [lat,lon]=RangePoint(rangeNm,i*2*Pi/rangeBoundary.size());
            const auto p=project(lat,lon);
            rangeBoundary[i]=Gdiplus::Point(static_cast<int>(p.x),static_cast<int>(p.y));
        }
        Gdiplus::GraphicsPath visibleRange;
        if(visibleRange.AddPolygon(rangeBoundary.data(),static_cast<int>(rangeBoundary.size()))!=Gdiplus::Ok||
           graphics.SetClip(&visibleRange,Gdiplus::CombineModeIntersect)!=Gdiplus::Ok)return;
        graphics.SetInterpolationMode(Gdiplus::InterpolationModeNearestNeighbor);
        std::string status;
        if(mask&Rain){
            LoadGrid(folder,height,mode,now);
            status="Reflectivity "+std::to_string(static_cast<int>(height/.3048+0.5))+" ft MSL";
            if(echo&&Fresh(observed))graphics.DrawImage(echo.get(),points,3,0,0,GridWidth,GridHeight,Gdiplus::UnitPixel);
            else status+=": waiting for ZYZTools / data unavailable";
        }
        if(mode&&(mask&Lightning)){
            if(!status.empty())status+=" | ";
            status+="Synthetic lightning";
            Gdiplus::Pen bolt(Gdiplus::Color(220,255,235,104),2);
            const auto mark=[&](double x,double y){
                auto p=project(North-y/100,West+x/100);
                const int px=static_cast<int>(p.x),py=static_cast<int>(p.y);
                Gdiplus::Point zig[]={{px+2,py-7},{px-3,py},{px+3,py},{px-2,py+7}};
                graphics.DrawLines(&bolt,zig,4);
            };
            if(mode==1){mark(158,162);mark(208,125);}
            if(mode==2)for(int j=0;j<8;j+=2)mark(72+j*37,215-j*19);
        }
        for(int i:{1}){
            if(mode)continue;
            if(!(mask&(1<<i)))continue;
            auto& f=frames[i];
            if(f.pending.valid()&&f.pending.wait_for(std::chrono::seconds(0))==std::future_status::ready){
                try{
                    const auto bytes=f.pending.get();
                    if(!bytes.empty()){
                        auto* stream=SHCreateMemStream(bytes.data(),static_cast<UINT>(bytes.size()));
                        if(stream){
                            std::unique_ptr<Gdiplus::Image> image(Gdiplus::Image::FromStream(stream,FALSE));
                            auto filtered=image&&image->GetLastStatus()==Gdiplus::Ok?LightningPixels(*image):nullptr;
                            image.reset();stream->Release();
                            if(filtered){f.Clear();f.image=std::move(filtered);f.received=now;}
                        }
                    }
                }catch(...){}
                f.next=now+(f.received==now?std::chrono::minutes(5):std::chrono::minutes(1));
            }
            // Serialize fetches so one radar screen never floods the service.
            if(!f.pending.valid()&&now>=f.next&&!std::any_of(frames.begin(),frames.end(),[](const auto& x){return x.pending.valid();})){
                try{f.pending=std::async(std::launch::async,Fetch,L"Lightning_2.5km_Density");}
                catch(...){f.next=now+std::chrono::minutes(1);}
            }
            if(!status.empty())status+=" | ";
            status+="Lightning density";
            if(!f.image||now-f.received>std::chrono::minutes(20)){
                status+=f.pending.valid()?": loading":": unavailable";
                continue;
            }
            const auto age=std::chrono::duration_cast<std::chrono::minutes>(now-f.received).count();
            status+=": fetched "+std::to_string(age)+"m ago";
            Gdiplus::ColorMatrix tint={{{1,0,0,0,0},{0,1,0,0,0},{0,0,1,0,0},{0,0,0,i==2?.32f:i==0?.54f:.85f,0},{0,0,0,0,1}}};
            Gdiplus::ImageAttributes attributes;attributes.SetColorMatrix(&tint);
            graphics.DrawImage(f.image.get(),points,3,0,0,512,512,Gdiplus::UnitPixel,&attributes);
        }
        static constexpr const char* labels[]={"LIVE","TEST: INTENSE CELLS","TEST: SQUALL LINE","TEST: LIGHT RAIN","TEST: CLEAR SKIES"};
        const std::string caption=std::string("WX (SIM) | ")+labels[mode]+" | "+std::to_string(rangeNm)+" NM CYYZ | "+status;
        const int saved=SaveDC(dc);
        if(saved){SetBkMode(dc,OPAQUE);SetBkColor(dc,RGB(12,20,24));SetTextColor(dc,RGB(195,222,232));
            TextOutA(dc,clip.left+8,clip.bottom-24,caption.c_str(),static_cast<int>(caption.size()));RestoreDC(dc,saved);}
    }
};
}
